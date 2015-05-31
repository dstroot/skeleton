'use strict';

/**
 * Module Dependencies
 */

var User          = require('../models/User');
var utils         = require('../config/utils');
var config        = require('../config/config');
var bcrypt        = require('bcrypt-nodejs');
var twilio        = require('twilio')(config.twilio.sid, config.twilio.token);
var passport      = require('passport');
var passportConf  = require('../config/passport');

/**
 * Enhanced Security Controller
 */

module.exports.controller = function (app) {

  /**
   * ==============================================
   *    COMMON ROUTES FOR BOTH TOTP AND SMS
   * ==============================================
   */

  /**
   * GET /enable-enhanced-security (requires authentication)
   *
   *     Begin the enhanced security setup process.
   */

  app.get('/enable-enhanced-security', passportConf.isAuthenticated, function (req, res) {
    if (req.user.enhancedSecurity.enabled) {
      req.flash('info', { msg: 'You already enabled enhanced security.' });
      return res.redirect('back');
    }
    res.render('twofactor/enable-enhanced-security', {
      url: '/account', // to set navbar active state
      user: req.user
    });
  });

  /**
   * GET /complete-enhanced-security (requires authentication)
   *
   *     Finalize enhanced security setup with the user.
   */

  app.get('/complete-enhanced-security', passportConf.isAuthenticated, function (req, res) {
    res.render('twofactor/complete-enhanced-security', {
      url: '/account', // to set navbar active state
      user: req.user
    });
  });

  /**
   * GET /verify-setup
   *
   *     Prepare for code validation. If the user
   *     is using SMS send them their code. Otherwise
   *     Continue to /verify-code.
   *     Used for both TOTP and SMS authentication.
   */

  app.get('/verify-setup', function (req, res) {
    if ((req.user.enhancedSecurity.enabled) && (req.user.enhancedSecurity.type === 'sms')) {

      // NOTE: The JavaScript date is  based on a time value that is milliseconds
      // since midnight 01 January, 1970 UTC. A day holds 86,400,000 milliseconds.
      // To convert the Mongo date we need to parse it so we can compare it to "now".

      // If we don't already have a token (so user can reload page, etc.)
      if ((Date.parse(req.user.enhancedSecurity.smsExpires) < Date.now()) || (!req.user.enhancedSecurity.sms)) {

        // Generate a six digit SMS token
        var sms = utils.randomSMS(6);

        // SMS Expiration Period (5 Minutes)
        var minute = 60000;
        var expiration = (minute * 5);

        // Hash the SMS token prior to saving it
        bcrypt.genSalt(10, function (err, salt) {
          bcrypt.hash(sms, salt, null, function (err, hash) {
            // Save the SMS token
            User.findById(req.user.id, function (err, user) {
              if (err) {
                req.flash('error', { msg: err.message });
                return res.redirect('back');
              }
              user.enhancedSecurity.sms = hash;
              user.enhancedSecurity.smsExpires = Date.now() + expiration;
              user.save(function (err) {
                if (err) {
                  req.flash('error', { msg: err.message });
                  return res.redirect('back');
                }
              });
              // Send the SMS token to the User
              var message = {
                to: user.profile.phone.mobile,
                from: config.twilio.phone,
                body: 'Your ' + app.locals.application + ' login code is: ' + sms + '.'
              };
              twilio.sendMessage(message, function (err, responseData) {
                if (err) {
                  req.flash('error', { msg: err.message });
                  return res.redirect('back');
                }
                req.flash('info', { msg: 'A login code was sent to your mobile phone.' });
                res.redirect('/verify-code');
              });
            });
          });
        });
      } else {
        res.redirect('/verify-code');
      }
    } else {
      req.flash('info', { msg: 'Use your mobile app to get your login code.' });
      res.redirect('/verify-code');
    }
  });

  /**
   * GET /verify-code
   *
   *     Get OTP Code from user for validation.
   *     Used for both TOTP and SMS authentication.
   */

  app.get('/verify-code', function (req, res) {
    res.render('twofactor/verify-code', {
      url: '/account', // to set navbar active state
      user: req.user
    });
  });

  /**
   * POST /verify-otp
   *
   *   Verify OTP Password
   */

  app.post('/verify-code', function (req, res, next) {
    // Handle SMS
    if ((req.user.enhancedSecurity.enabled) && (req.user.enhancedSecurity.type === 'sms')) {
      // Get the user using their ID and make sure their sms token hasn't expired yet
      User.findOne({ _id: req.user.id })
        .where('enhancedSecurity.smsExpires').gt(Date.now())
        .exec(function (err, user) {
          if (err) {
            req.flash('error', { msg: err.message });
            return res.redirect('back');
          }
          if (!user) {
            req.flash('error', { msg: 'Your code has expired.' });
            return res.redirect('/verify-setup');
          }
          // Validate their SMS token
          user.compareSMS(req.body.code, function (err, isMatch) {
            if (err) {
              req.flash('error', { msg: err.message });
              return res.redirect('back');
            }
            if (isMatch) {
              // Clean out SMS token
              User.findById(req.user.id, function (err, user) {
                if (err) {
                  req.flash('error', { msg: err.message });
                  return res.redirect('back');
                }
                user.enhancedSecurity.sms = null;
                user.enhancedSecurity.smsExpires = null;
                user.save(function (err) {
                  if (err) {
                    req.flash('error', { msg: err.message });
                    return res.redirect('back');
                  }
                });
              });
              // Save the fact that we have authenticated via two factor
              req.session.passport.secondFactor = 'validated';
              // Send user on their merry way
              if (req.session.attemptedURL) {
                var redirectURL = req.session.attemptedURL;
                delete req.session.attemptedURL;
                res.redirect(redirectURL);
              } else {
                res.redirect('/');
              }
            } else {
              req.flash('error', { msg: 'That code is invalid.' });
              return res.redirect('back');
            }
          });
        });
    }
    // Handle TOTP
    if ((req.user.enhancedSecurity.enabled) && (req.user.enhancedSecurity.type === 'totp')) {
      // Use Passport's TOTP authentication
      passport.authenticate('totp', function (err, user, info) {
        if (err) {
          req.flash('error', { msg: err.message });
          return res.redirect('back');
        } else {
          // Log user in
          req.logIn(user, function (err) {
            if (err) {
              req.flash('error', { msg: 'That code is invalid.' });
              return res.redirect('back');
            } else {
              // Save the fact that we have authenticated via two factor
              req.session.passport.secondFactor = 'validated';
              // Send user on their merry way
              if (req.session.attemptedURL) {
                var redirectURL = req.session.attemptedURL;
                delete req.session.attemptedURL;
                res.redirect(redirectURL);
              } else {
                res.redirect('/');
              }
            }
          });
        }
      })(req, res, next);
    }
  });

  /**
   * GET /disable-enhanced-security (requires authentication)
   *   Turns *off* two factor enhanced security
   */

  app.get('/disable-enhanced-security', passportConf.isAuthenticated, function (req, res) {
    // Get user
    User.findById(req.user.id, function (err, user) {
      if (err) {
        req.flash('error', { msg: err.message });
        return (err);
      }
      // Remove enhanced security profile
      user.enhancedSecurity = null;
      user.activity.last_updated = Date.now();
      user.save(function (err) {
        if (err) {
          req.flash('error', { msg: err.message });
          return (err);
        }
      });
    });
    // Then redirect back to account
    req.flash('info', { msg: 'Enhanced security has been turned off.' });
    res.redirect('/account');

    // TODO:
    // In a real scenario we would also send the person an email notifying them
    // that enhanced security has been turned off.  This is an extra measure of
    // security in case somehow they did not initiate the action (much like a
    // password change email).  There are examples in the user.js and account.js
    // controllers.

  });

  /**
   * ==============================================
   *    TOTP ROUTES
   * ==============================================
   */

  /**
   * GET /setup-totp (requires authentication)
   *
   *    Create a TOTP key and share it with the user
   *    via QR code and base32 encoded key so they
   *    can setup their mobile app.
   */

  app.get('/setup-totp', passportConf.isAuthenticated, function (req, res) {
    // Prevent someone from seeing your QR code if enhanced security is *already* enabled.
    // Otherwise if they knew the URL and had access to your machine while
    // you were already logged in they could make it display.
    if (req.user.enhancedSecurity.enabled) {
      req.flash('info', { msg: 'You already enabled enhanced security.' });
      return res.redirect('back');
    }
    // Make this page idempotent in case user hits back or refresh
    var key;
    if (typeof req.user.enhancedSecurity.token === 'undefined') {
      // Generate a new key
      key = utils.randomKey(10);
      // Save the key for the user
      User.findById(req.user.id, function (err, user) {
        if (err) {
          req.flash('error', { msg: err.message });
          return (err);
        }
        user.enhancedSecurity.token = key;
        user.enhancedSecurity.period = 30;
        user.save(function (err) {
          if (err) {
            req.flash('error', { msg: err.message });
            return (err);
          }
        });
      });
    } else {
      // Just use existing key
      key = req.user.enhancedSecurity.token;
    }
    // encode key to base32
    var encodedKey = utils.encode(key);
    // Generate QR code
    // Reference: https://code.google.com/p/google-authenticator/wiki/KeyUriFormat
    var otpUrl = 'otpauth://totp/' + config.name + ':%20' + req.user.email + '?issuer=' + config.name + '&secret=' + encodedKey + '&period=30';
    var qrImage = 'https://chart.googleapis.com/chart?chs=166x166&chld=L|0&cht=qr&chl=' + encodeURIComponent(otpUrl);
    // Render the setup page
    res.render('twofactor/setup-totp', {
      user: req.user,
      url: '/account', // to set navbar active state
      key: encodedKey,
      qrImage: qrImage
    });

  });

  /**
   * GET /verify-totp-first (requires authentication)
   *
   *   Test key validation.  Ensure that TOTP works
   *   for user BEFORE we turn on enhanced security!
   */

  app.get('/verify-totp-first', passportConf.isAuthenticated, function (req, res) {
    res.render('twofactor/verify-totp-first', {
      url: '/account', // to set navbar active state
      user: req.user
    });
  });

  /**
   * POST /verify-otp-first (requires authentication)
   *
   *   If the code is verified then turn on enhanced security
   *   and redirect to the 'complete-enhanced-security' page.
   */

  app.post('/verify-totp-first', passportConf.isAuthenticated, function (req, res, next) {
    passport.authenticate('totp', function (err, user, info) {
      if (err) {
        req.flash('error', { msg: err.message });
        return res.redirect('back');
      } else {
        // Log user in
        req.logIn(user, function (err) {
          if (err) {
            req.flash('error', { msg: 'That code is invalid.' });
            return res.redirect('back');
          } else {
            // Finalize enabling enhanced security by setting enhancedSecurity.enabled = true
            User.findById(req.user.id, function (err, user) {
              if (err) {
                req.flash('error', { msg: err.message });
                return (err);
              }
              user.enhancedSecurity.enabled = true;
              user.enhancedSecurity.type = 'totp';
              user.activity.last_updated = Date.now();
              user.save(function (err) {
                if (err) {
                  req.flash('error', { msg: err.message });
                  return (err);
                }
              });
            });
            // Save the fact that we have authenticated via two factor
            req.session.passport.secondFactor = 'validated';
            // Complete enhanced security setup
            res.redirect('/complete-enhanced-security');
          }
        });
      }
    })(req, res, next);
  });

  /**
   * ==============================================
   *    SMS ROUTES
   * ==============================================
   */

  /**
   * GET /setup-sms (requires authentication)
   *
   *     Initiate SMS setup - need to capture or
   *     validate the users mobile phone number.
   */

  app.get('/setup-sms', passportConf.isAuthenticated, function (req, res) {
    res.render('twofactor/setup-sms', {
      user: req.user,
      url: '/account' // to set navbar active state
    });
  });

  /**
   * POST /setup-sms (requires authentication)
   *
   *      Save the user's mobile phone number and send them a
   *      SMS message with a one-time code to test.
   */

  app.post('/setup-sms', passportConf.isAuthenticated, function (req, res) {
    // Generate a six digit key
    var sms = utils.randomSMS(6);
    // SET SMS Expiration Period (5 Minutes)
    var minute = 60000;
    var expiration = (minute * 5);
    // Hash the SMS token prior to saving it
    bcrypt.genSalt(10, function (err, salt) {
      bcrypt.hash(sms, salt, null, function (err, hash) {
        // Save the Mobile number and SMS for the user
        User.findById(req.user.id, function (err, user) {
          if (err) {
            req.flash('error', { msg: err.message });
            return (err);
          }
          user.profile.phone.mobile = req.body.phoneMobile;
          user.enhancedSecurity.sms = hash;
          user.enhancedSecurity.smsExpires = Date.now() + expiration;
          user.activity.last_updated = Date.now();
          user.save(function (err) {
            if (err) {
              req.flash('error', { msg: err.message });
              return (err);
            }
          });
        });
        // Send the SMS Text to the User
        var message = {
          to: req.body.phoneMobile,
          from: config.twilio.phone,
          body: 'Your ' + app.locals.application + ' login code is: ' + sms + '.'
        };
        twilio.sendMessage(message, function (err, responseData) {
          if (err) {
            req.flash('error', { msg: err.message });
            return res.redirect('back');
          }
          req.flash('success', { msg: 'A login code was sent to your mobile phone.' });
          res.redirect('/verify-sms-first');
        });
      });
    });
  });

  /**
   * GET /verify-sms-first (requires authentication)
   *
   *     Verify that the user's SMS test code works.
   */

  app.get('/verify-sms-first', passportConf.isAuthenticated, function (req, res, next) {
    res.render('twofactor/verify-sms-first', {
      user: req.user,
      url: '/account' // to set navbar active state
    });
  });

  /**
   * POST /verify-sms-first (requires authentication)
   *
   *   If the code is verified then turn on enhanced security
   *   and redirect to the 'complete-enhanced-security' page.
   */

  app.post('/verify-sms-first', passportConf.isAuthenticated, function (req, res, next) {
    // Get the user using their ID and make sure their sms token hasn't expired yet
    User.findOne({ _id: req.user.id })
      .where('enhancedSecurity.smsExpires').gt(Date.now())
      .exec(function (err, user) {
        if (err) {
          req.flash('error', { msg: err.message });
          return res.redirect('back');
        }
        if (!user) {
          req.flash('error', { msg: 'Your code has expired.' });
          return res.redirect('back');
        }
        // Validate their SMS token
        user.compareSMS(req.body.code, function (err, isMatch) {
          if (isMatch) {
            // Finalize enabling enhanced security
            user.enhancedSecurity.enabled = true;
            user.enhancedSecurity.type = 'sms';
            user.enhancedSecurity.sms = null;
            user.enhancedSecurity.smsExpires = null;
            user.activity.last_updated = Date.now();
            user.save(function (err) {
              if (err) {
                req.flash('error', { msg: err.message });
                return res.redirect('back');
              }
            });
            // Save the fact that we have authenticated via two factor
            req.session.passport.secondFactor = 'validated';
            // Complete enhanced security setup
            res.redirect('/complete-enhanced-security');
          } else {
            req.flash('error', { msg: 'That code is invalid.' });
            return res.redirect('back');
          }
        });
      });
  });

};
