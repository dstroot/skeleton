'use strict';

/**
 * Module Dependencies
 */

var async         = require('async');
var passport      = require('passport');
var nodemailer    = require('nodemailer');
var User          = require('../models/User');
var config        = require('../config/config');
var LoginAttempt  = require('../models/LoginAttempt');

/**
 * User Controller
 */

module.exports.controller = function(app) {

/**
 * GET /login
 * Render login page
 */

  app.get('/login', function(req, res) {
    if (req.user) {
      req.flash('info', { msg: 'You are already logged in silly!' });
      return res.redirect('/api');
    }
    // Turn off login form if too many attempts
    var tooManyAttempts = req.session.tooManyAttempts || false;
    req.session.tooManyAttempts = null;

    res.render('account/login', {
      tooManyAttempts: tooManyAttempts,
      url: req.url
    });
  });

/**
 * POST /login
 * Log the user in
 */

  app.post('/login', function(req, res, next) {


    // Begin a workflow
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the data
     */

    workflow.on('validate', function() {

      // Validate the form fields
      req.assert('email', 'Email is not valid').isEmail();
      req.assert('password', 'Password cannot be blank').notEmpty();

      var errors = req.validationErrors();

      if (errors) {
        req.flash('errors', errors);
        return res.redirect('/login');
      }

      // next step
      workflow.emit('abuseFilter');
    });

    /**
     * Step 2: Prevent brute force login hacking
     */

    workflow.on('abuseFilter', function() {
      var getIpCount = function(done) {
        var conditions = { ip: req.ip };
        LoginAttempt.count(conditions, function(err, count) {
          if (err) {
            return done(err);
          }
          done(null, count);
        });
      };

      var getIpUserCount = function(done) {
        var conditions = { ip: req.ip, user: req.body.email };
        LoginAttempt.count(conditions, function(err, count) {
          if (err) {
            return done(err);
          }
          done(null, count);
        });
      };

      var asyncFinally = function(err, results) {
        if (err) {
          return workflow.emit('exception', err);
        }

        if ( results.ip >= config.loginAttempts.forIp || results.ipUser >= config.loginAttempts.forUser ) {
          req.flash('errors', { msg: 'You\'ve reached the maximum number of login attempts. Please try again later or reset your password.' });
          req.session.tooManyAttempts = true;
          return res.redirect('/login');
        }
        else {
          workflow.emit('authenticate');
        }

      };

      async.parallel({ ip: getIpCount, ipUser: getIpUserCount }, asyncFinally);
    });

    /**
     * Step 3: Authenticate the user
     */

    workflow.on('authenticate', function () {

      // Authenticate the user
      passport.authenticate('local', function(err, user, info) {
        if (err) {
          return next(err);
        }

        if (!user) {

          // Update abuse count
          var fieldsToSet = { ip: req.ip, user: req.body.email };
          LoginAttempt.create(fieldsToSet, function(err, doc) {
            if (err) {
              return next(err);
            } else {
              // User Not Found (Return)
              req.flash('errors', { msg: info.message });
              return res.redirect('/login');
            }
          });

        } else {

          // update the user's record with login timestamp
          user.activity.last_logon = Date.now();
          user.save(function(err) {
            if (err) {
              return next(err);
            }
          });

          // Log user in
          req.logIn(user, function(err) {
            if (err) {
              return next(err);
            }
            return res.redirect('/api');
          });

        }

      })(req, res, next);

    });

    /**
     * Initiate the workflow
     */

    workflow.emit('validate');

  });

/**
 * GET /logout
 * Log the user out
 */

  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
  });

  /**
   * GET /signup
   * Render signup page
   */

  app.get('/signup', function (req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    res.render('account/signup', {
      url: req.url
    });
  });

  /**
   * POST /signup
   * Process a *regular* signup
   */

  app.post('/signup', function (req, res, next) {

    // Begin a workflow
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the form fields
     */

    workflow.on('validate', function() {

      // Check for form errors
      req.assert('email', 'Email is not valid.').isEmail();
      req.assert('password', 'Password must be at least 4 characters long.').len(4);
      req.assert('confirmPassword', 'Passwords do not match.').equals(req.body.password);

      var errors = req.validationErrors();

      if (errors) {
        req.flash('errors', errors);
        return res.redirect('back');
      }

      // next step
      workflow.emit('createUser');
    });

    /**
     * Step 2: Create a new account
     */

    workflow.on('createUser', function() {
      // create user
      var user = new User({
        'profile.name': req.body.name,
        email: req.body.email,
        password: req.body.password
      });
      // save user
      user.save(function(err) {
        if (err) {
          if (err.code === 11000) {
            req.flash('errors', { msg: 'User with that email already exists.' });
          }
          return res.redirect('back');
        } else {
          // next step
          workflow.emit('sendWelcomeEmail', user);
        }
      });

    });

    /**
     * Step 3: Send them a welcome email
     */

    workflow.on('sendWelcomeEmail', function (user) {

      // Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      var smtpTransport = nodemailer.createTransport('SMTP',{
        service: 'Gmail',
        auth: {
          user: config.gmail.user,
          pass: config.gmail.password
        }
        // See nodemailer docs for other transports
        // https://github.com/andris9/Nodemailer
      });

      // Render HTML to send using .jade mail template (just like rendering a page)
      res.render('mail/welcome', {
        name:          user.profile.name,
        mailtoName:    config.smtp.name,
        mailtoAddress: config.smtp.address,
        blogLink:      req.protocol + '://' + req.headers.host, // + '/blog',
        forumLink:     req.protocol + '://' + req.headers.host  // + '/forum'
      }, function(err, html) {
        if (err) {
          return (err, null);
        }
        else {

          // Now create email text (multiline string as array FTW)
          var text = [
            'Hello ' + user.profile.name + '!',
            'We would like to welcome you as our newest member!',
            'Thanks so much for using our services! If you have any questions, or suggestions, feel free to email us here at ' + config.smtp.address + '.',
            'If you want to get the latest scoop check out our <a href="' +
            req.protocol + '://' + req.headers.host + '/blog' +
            '">blog</a> and our <a href="' +
            req.protocol + '://' + req.headers.host + '/forums">forums</a>.',
            '  - The ' + config.smtp.name + ' team'
          ].join('\n\n');

          // Create email
          var mailOptions = {
            to:       user.profile.name + ' <' + user.email + '>',
            from:     config.smtp.name + ' <' + config.smtp.address + '>',
            subject:  'Welcome to ' + app.locals.title + '!',
            text:     text,
            html:     html
          };

          // send email via nodemailer
          smtpTransport.sendMail(mailOptions, function(err) {
            if (err) {
              req.flash('errors', { msg: err.message });
            }
          });

          // shut down the connection pool, no more messages
          smtpTransport.close();
        }
      });

      // next step
      workflow.emit('logUserIn', user);
    });

    /**
     * Step 4: Log them in
     */

    workflow.on('logUserIn', function (user) {

      // log the user in
      req.logIn(user, function(err) {
        if (err) {
          return next(err);
        }
        req.flash('info', { msg: 'Thanks for signing up! You rock!' });
        res.redirect('/api');
      });

    });

    /**
     * Initiate the workflow
     */

    workflow.emit('validate');

  });

// WORKING HERE




  /**
   * POST /signupsocial
   * Process a *Social* signup - confirm email address
   */

  app.post('/signupsocial', function (req, res, next) {

    // Begin a workflow
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the form fields
     */

    workflow.on('validate', function() {

      // Check for form errors
      req.assert('email', 'Email is not valid.').isEmail();

      var errors = req.validationErrors();

      if (errors) {
        req.flash('errors', errors);
        return res.redirect('back');
      }

      // next step
      workflow.emit('duplicateEmailCheck');
    });

    /**
     * Step 2: Make sure the email address is unique
     */

    workflow.on('duplicateEmailCheck', function() {

      // Make sure we have a unique email address!
      User.findOne({ email: req.body.email.toLowerCase() }, function (err, user) {
        if (err) {
          return (err);
        }
        if (user) {
          req.flash('errors', { msg: 'That email address has already been used!' });
          return res.redirect('back');
        }
      });

      // next step
      workflow.emit('linkUser');
    });

    /**
     * Step 3: If we have a user with the same email address just link the accounts
     */

    workflow.on('linkUser', function() {

      var newUser = req.session.socialProfile;
      delete req.session.socialProfile;

      // Do we have an existing user with the same email? If so link the account.
      var searchString = '{ email: ' + req.body.email.toLowerCase() + ', ' + newUser.source + ': { $exists: false } }';
      User.findOne(searchString, function (err, existingUser) {
        if (err) {
          return (err);
        }
        if (existingUser) {  // Link the new social information to the persons account

          if ( newUser.source === 'twitter' ) {
            existingUser.twitter = newUser.id;
            existingUser.tokens.push({ kind: 'twitter', accessToken: newUser.accessToken, tokenSecret: newUser.tokenSecret });

          } else if ( newUser.source === 'facebook'  ) {
            existingUser.facebook = newUser.id;
            existingUser.tokens.push({ kind: 'facebook', accessToken: newUser.accessToken });

          } else if ( newUser.source === 'github'  ) {
            existingUser.github = newUser.id;
            existingUser.tokens.push({ kind: 'github', accessToken: newUser.accessToken });

          } else if ( newUser.source === 'google'  ) {
            existingUser.google = newUser.id;
            existingUser.tokens.push({ kind: 'google', accessToken: newUser.accessToken });
          }

          existingUser.profile.name     = existingUser.profile.name     || newUser.profile.name;
          existingUser.profile.gender   = existingUser.profile.gender   || newUser.profile.gender;
          existingUser.profile.location = existingUser.profile.location || newUser.profile.location;
          existingUser.profile.website  = existingUser.profile.website  || newUser.profile.website;
          existingUser.profile.picture  = existingUser.profile.picture  || newUser.profile.picture;

          existingUser.save(function (err) {
            if (err) {
              return (err);
            }

            // to capitalize the provider name
            String.prototype.capitalize = function() {
              return this.charAt(0).toUpperCase() + this.slice(1);
            };

            req.flash('info', { msg: 'Your ' + newUser.source.capitalize() + ' account has been linked to your existing account!' });
            return res.redirect('/api');
          });
        }
      });

      // next step
      workflow.emit('createUser', newUser);

    });

    /**
     * Step 4: Create a new account
     */

    workflow.on('createUser', function (newUser) {

      var user = new User();

      user.email            = req.body.email.toLowerCase();
      user.profile.name     = newUser.profile.name;
      user.profile.gender   = newUser.profile.gender;
      user.profile.location = newUser.profile.location;
      user.profile.website  = newUser.profile.website;
      user.profile.picture  = newUser.profile.picture;

      if ( newUser.source === 'twitter' ) {
        user.twitter = newUser.id;
        user.tokens.push({ kind: 'twitter', accessToken: newUser.accessToken, tokenSecret: newUser.tokenSecret });

      } else if ( newUser.source === 'facebook'  ) {
        user.facebook = newUser.id;
        user.tokens.push({ kind: 'facebook', accessToken: newUser.accessToken });

      } else if ( newUser.source === 'github'  ) {
        user.github = newUser.id;
        user.tokens.push({ kind: 'github', accessToken: newUser.accessToken });

      } else if ( newUser.source === 'google'  ) {
        user.google = newUser.id;
        user.tokens.push({ kind: 'google', accessToken: newUser.accessToken });
      }

      // save user
      user.save(function(err) {
        if (err) {
          if (err.code === 11000) {
            req.flash('errors', { msg: 'User with that email already exists!' });
          }
          return res.redirect('back');
        } else {
          // next step
          workflow.emit('sendWelcomeEmail', user);
        }
      });

    });

    /**
     * Step 5: Send them a welcome email
     */

    workflow.on('sendWelcomeEmail', function (user) {

      // Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      var smtpTransport = nodemailer.createTransport('SMTP',{
        service: 'Gmail',
        auth: {
          user: config.gmail.user,
          pass: config.gmail.password
        }
        // See nodemailer docs for other transports
        // https://github.com/andris9/Nodemailer
      });

      // Render HTML to send using .jade mail template (just like rendering a page)
      res.render('mail/welcome', {
        name:          user.profile.name,
        mailtoName:    config.smtp.name,
        mailtoAddress: config.smtp.address,
        blogLink:      req.protocol + '://' + req.headers.host, // + '/blog',
        forumLink:     req.protocol + '://' + req.headers.host  // + '/forum'
      }, function(err, html) {
        if (err) {
          return (err, null);
        }
        else {

          // Now create email text (multiline string as array FTW)
          var text = [
            'Hello ' + user.profile.name + '!',
            'We would like to welcome you as our newest member!',
            'Thanks so much for using our services! If you have any questions, or suggestions, feel free to email us here at ' + config.smtp.address + '.',
            'If you want to get the latest scoop check out our <a href="' +
            req.protocol + '://' + req.headers.host + '/blog' +
            '">blog</a> and our <a href="' +
            req.protocol + '://' + req.headers.host + '/forums">forums</a>.',
            '  - The ' + config.smtp.name + ' team'
          ].join('\n\n');

          // Create email
          var mailOptions = {
            to:       user.profile.name + ' <' + user.email + '>',
            from:     config.smtp.name + ' <' + config.smtp.address + '>',
            subject:  'Welcome to ' + app.locals.title + '!',
            text:     text,
            html:     html
          };

          // send email via nodemailer
          smtpTransport.sendMail(mailOptions, function(err) {
            if (err) {
              req.flash('errors', { msg: err.message });
            }
          });

          // shut down the connection pool, no more messages
          smtpTransport.close();
        }
      });

      // next step
      workflow.emit('logUserIn', user);
    });

    /**
     * Step 6: Log them in
     */

    workflow.on('logUserIn', function (user) {

      // log the user in
      req.logIn(user, function(err) {
        if (err) {
          return next(err);
        }
        req.flash('info', { msg: 'Thanks for signing up! You rock!' });
        res.redirect('/api');
      });

    });

    /**
     * Initiate the workflow
     */

    workflow.emit('validate');

  });

  /**
   * Facebook Authorization
   */

  app.get('/auth/facebook',
    passport.authenticate('facebook', {
      callbackURL: '/auth/facebook/callback'
    })
  );

  app.get('/auth/facebook/callback', function (req, res, next) {
    passport.authenticate('facebook', { callbackURL: '/auth/facebook/callback' }, function (err, user, info) {
      if (!info || !info.profile) {
        req.flash('errors', { msg: 'We have no data. Something went terribly wrong!' });
        return res.redirect('/login');
      }

      // Do we already have a user with this Facebook ID?
      // If so, then it's just a login - timestamp it.
      User.findOne({ facebook: info.profile._json.id }, function (err, justLogin) {
        if (err) {
          return next(err);
        }
        if (justLogin) {
          // Update the user's record with login timestamp
          justLogin.activity.last_logon = Date.now();
          justLogin.save(function(err) {
            if (err) {
              return next(err);
            }
            // Log the user in
            req.login(justLogin, function(err) {
              if (err) {
                return next(err);
              }
              return res.redirect('/api');
            });
          });
        } else {
          // Brand new Facebook user!
          // Save their profile data into the session
          var newSocialUser               = {};
          newSocialUser.profile           = {};

          newSocialUser.email             = info.profile._json.email;
          newSocialUser.profile.name      = info.profile._json.name;
          newSocialUser.profile.gender    = info.profile._json.gender;
          newSocialUser.profile.location  = info.profile._json.location.name;
          newSocialUser.profile.website   = info.profile._json.link;
          newSocialUser.profile.picture   = 'https://graph.facebook.com/' + info.profile.id + '/picture?type=large';
          newSocialUser.source            = 'facebook';
          newSocialUser.id                = info.profile._json.id;
          newSocialUser.accessToken       = info.accessToken;
          newSocialUser.tokenSecret       = '';

          req.session.socialProfile = newSocialUser;
          res.render('account/signupsocial', { email: newSocialUser.email });
        }
      });

    })(req, res, next);
  });

  /**
   * Github Authorization
   */

  app.get('/auth/github',
    passport.authenticate('github', {
      callbackURL: '/auth/github/callback'
    })
  );

  app.get('/auth/github/callback', function (req, res, next) {
    passport.authenticate('github', { callbackURL: '/auth/github/callback' }, function (err, user, info) {
      if (!info || !info.profile) {
        req.flash('errors', { msg: 'We have no data. Something went terribly wrong!' });
        return res.redirect('/login');
      }

      // Do we already have a user with this GitHub ID?
      // If so, then it's just a login - timestamp it.
      User.findOne({ github: info.profile._json.id }, function (err, justLogin) {
        if (err) {
          return next(err);
        }
        if (justLogin) {
          // Update the user's record with login timestamp
          justLogin.activity.last_logon = Date.now();
          justLogin.save(function(err) {
            if (err) {
              return next(err);
            }
            // Log the user in
            req.login(justLogin, function(err) {
              if (err) {
                return next(err);
              }
              return res.redirect('/api');
            });
          });
        } else {
          // Brand new GitHub user!
          // Save their profile data into the session
          var newSocialUser               = {};
          newSocialUser.profile           = {};

          newSocialUser.email             = info.profile._json.email;
          newSocialUser.profile.name      = info.profile._json.name;
          newSocialUser.profile.gender    = ''; // No gender from Github
          newSocialUser.profile.location  = info.profile._json.location;
          newSocialUser.profile.website   = info.profile._json.html_url;
          newSocialUser.profile.picture   = info.profile._json.avatar_url;
          newSocialUser.source            = 'github';
          newSocialUser.id                = info.profile._json.id;
          newSocialUser.accessToken       = info.accessToken;
          newSocialUser.tokenSecret       = '';

          req.session.socialProfile = newSocialUser;
          res.render('account/signupsocial', { email: newSocialUser.email });
        }
      });

    })(req, res, next);
  });

  /**
   * Google Authorization
   */

  app.get('/auth/google',
    passport.authenticate('google', {
      callbackURL: '/auth/google/callback'
    })
  );

  app.get('/auth/google/callback', function (req, res, next) {
    passport.authenticate('google', { callbackURL: '/auth/google/callback' }, function (err, user, info) {
      if (!info || !info.profile) {
        req.flash('errors', { msg: 'We have no data. Something went terribly wrong!' });
        return res.redirect('/login');
      }

      // Do we already have a user with this Google ID?
      // If so, then it's just a login - timestamp it.
      User.findOne({ google: info.profile._json.id }, function (err, justLogin) {
        if (err) {
          return next(err);
        }
        if (justLogin) {
          // Update the user's record with login timestamp
          justLogin.activity.last_logon = Date.now();
          justLogin.save(function(err) {
            if (err) {
              return next(err);
            }
            // Log the user in
            req.login(justLogin, function(err) {
              if (err) {
                return next(err);
              }
              return res.redirect('/api');
            });
          });
        } else {
          // Brand new Google user!
          // Save their profile data into the session
          var newSocialUser               = {};
          newSocialUser.profile           = {};

          newSocialUser.email             = info.profile._json.email;
          newSocialUser.profile.name      = info.profile._json.name;
          newSocialUser.profile.gender    = info.profile._json.gender;
          newSocialUser.profile.location  = '';
          newSocialUser.profile.website   = info.profile._json.link;
          newSocialUser.profile.picture   = info.profile._json.picture;
          newSocialUser.source            = 'google';
          newSocialUser.id                = info.profile.id;
          newSocialUser.accessToken       = info.accessToken;
          newSocialUser.tokenSecret       = '';

          req.session.socialProfile = newSocialUser;
          res.render('account/signupsocial', { email: newSocialUser.email });
        }
      });

    })(req, res, next);
  });

  /**
   * Twitter Authorization
   */

  app.get('/auth/twitter',
    passport.authenticate('twitter', {
      callbackURL: '/auth/twitter/callback',
    })
  );

  app.get('/auth/twitter/callback', function (req, res, next) {
    passport.authenticate('twitter', { callbackURL: '/auth/twitter/callback' }, function (err, user, info) {
      if (!info || !info.profile) {
        req.flash('errors', { msg: 'We have no data. Something went terribly wrong!' });
        return res.redirect('/login');
      }

      // Do we already have a user with this Twitter ID?
      // If so, then it's just a login - timestamp it.
      User.findOne({ twitter: info.profile._json.id }, function (err, justLogin) {
        if (err) {
          return next(err);
        }
        if (justLogin) {
          // Update the user's record with login timestamp
          justLogin.activity.last_logon = Date.now();
          justLogin.save(function(err) {
            if (err) {
              return next(err);
            }
            // Log the user in
            req.login(justLogin, function(err) {
              if (err) {
                return next(err);
              }
              return res.redirect('/api');
            });
          });
        } else {
          // Brand new Twitter user!
          // Save their profile data into the session
          var newSocialUser               = {};
          newSocialUser.profile           = {};

          newSocialUser.email             = '';  // Twitter does not provide email addresses
          newSocialUser.profile.name      = info.profile._json.name;
          newSocialUser.profile.gender    = '';  // No gender from Twitter either
          newSocialUser.profile.location  = info.profile._json.location;
          newSocialUser.profile.website   = info.profile._json.entities.url.urls[0].expanded_url;
          newSocialUser.profile.picture   = info.profile._json.profile_image_url;
          newSocialUser.source            = 'twitter';
          newSocialUser.id                = info.profile.id;
          newSocialUser.accessToken       = info.accessToken;
          newSocialUser.tokenSecret       = info.tokenSecret;

          req.session.socialProfile = newSocialUser;
          res.render('account/signupsocial', { email: newSocialUser.email });
        }
      });

    })(req, res, next);
  });

};
