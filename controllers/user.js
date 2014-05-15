'use strict';

/**
 * Module Dependencies
 */

var User          = require('../models/User');
var async         = require('async');
var crypto        = require('crypto');
var config        = require('../config/config');
var passport      = require('passport');
var nodemailer    = require('nodemailer');
var LoginAttempt  = require('../models/LoginAttempt');

/**
 * User Controller
 */

module.exports.controller = function (app) {

/**
 * GET /login
 * Render login page
 */

  app.get('/login', function (req, res) {

    // Check if user is already logged in
    if (req.user) {
      req.flash('info', { msg: 'You are already logged!' });
      return res.redirect('/api');
    }

    // Turn off login form if too many attempts
    var tooManyAttempts = req.session.tooManyAttempts || false;
    req.session.tooManyAttempts = null;

    // Render Login form
    res.render('account/login', {
      tooManyAttempts: tooManyAttempts,
      url: req.url
    });

  });

/**
 * POST /login
 * Log the user in
 */

  app.post('/login', function (req, res, next) {

    // Begin a workflow
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the data
     */

    workflow.on('validate', function () {

      // Validate the form fields
      req.assert('email', 'Your email cannot be empty.').notEmpty();
      req.assert('email', 'Your email is not valid').isEmail();
      req.assert('password', 'Your password cannot be blank').notEmpty();
      req.assert('password', 'Your password must be at least 4 characters long.').len(4);

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

      var getIpCount = function (done) {
        var conditions = { ip: req.ip };
        LoginAttempt.count(conditions, function(err, count) {
          if (err) {
            return done(err);
          }
          done(null, count);
        });
      };

      var getIpUserCount = function (done) {
        var conditions = { ip: req.ip, user: req.body.email.toLowerCase() };
        LoginAttempt.count(conditions, function(err, count) {
          if (err) {
            return done(err);
          }
          done(null, count);
        });
      };

      var asyncFinally = function (err, results) {
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
      passport.authenticate('local', function (err, user, info) {
        if (err) {
          req.flash('errors', { msg: err.message });
          return res.redirect('back');
        }

        if (!user) {

          // Update abuse count
          var fieldsToSet = { ip: req.ip, user: req.body.email };
          LoginAttempt.create(fieldsToSet, function (err, doc) {
            if (err) {
              req.flash('errors', { msg: err.message });
              return res.redirect('back');
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
              req.flash('errors', { msg: err.message });
              return res.redirect('back');
            }
          });

          // Log user in
          req.logIn(user, function(err) {
            if (err) {
              req.flash('errors', { msg: err.message });
              return res.redirect('back');
            }

            // Send user on their merry way
            if (req.session.attemptedURL) {
              var redirectURL = req.session.attemptedURL;
              delete req.session.attemptedURL;
              res.redirect(redirectURL);
            } else {
              res.redirect('/api');
            }

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

  app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
  });

  /**
   * GET /verify/:id/:token
   * Verify the user after signup
   */

  app.get('/verify/:id/:token', function (req, res) {

    // Create a workflow
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the user and token
     */

    workflow.on('validate', function() {

      // Get the user using their ID and token
      User.findOne({ _id: req.params.id, verifyToken: req.params.token }, function(err, user) {
        if (err) {
          req.flash('errors', { msg: err.message });
          req.flash('warning', { msg: 'Your account verification is invalid or has expired.' });
          return res.redirect('/');
        }

        if (!user) {
          req.flash('warning', { msg: 'Your password reset request is invalid or has expired.' });
          return res.redirect('/');
        } else {

          // Let's verify the user!
          user.verified = true;
          user.verifyToken = undefined;
          user.activity.last_logon = Date.now();

          // update the user record
          user.save(function (err) {
            if (err) {
              req.flash('errors', { msg: err.message });
              return res.redirect('back');
            }

            // next step
            workflow.emit('sendWelcomeEmail', user);
          });
        }
      });
    });

    /**
     * Step 2: Send them a welcome email
     */

    workflow.on('sendWelcomeEmail', function (user) {

      // Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      var smtpTransport = nodemailer.createTransport('SMTP',{
        service: 'Gmail',
        auth: {
          user: config.gmail.user,
          pass: config.gmail.password
        }
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
            subject:  'Welcome to ' + app.locals.application + '!',
            text:     text,
            html:     html
          };

          // send email via nodemailer
          smtpTransport.sendMail(mailOptions, function(err) {
            if (err) {
              req.flash('errors', { msg: err.message });
            }
            // shut down the connection pool, no more messages
            smtpTransport.close();
          });

        }
      });

      // next step
      workflow.emit('logUserIn', user);
    });

    /**
     * Step 3: Log them in
     */

    workflow.on('logUserIn', function (user) {

      // log the user in
      req.logIn(user, function (err) {
        if (err) {
          req.flash('errors', { msg: err.message });
          return res.redirect('back');
        }
        req.flash('info', { msg: 'Welcome. Your account verification is completed!' });
        res.redirect('/api');
      });

      // WORKFLOW COMPLETED
    });

    /**
     * Initiate the workflow
     */

    workflow.emit('validate');

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
      req.assert('name', 'Your name cannot be empty.').notEmpty();
      req.assert('email', 'Your email cannot be empty.').notEmpty();
      req.assert('email', 'Your email is not valid.').isEmail();
      req.assert('password', 'Your password cannot be empty.').notEmpty();
      req.assert('confirmPassword', 'Your password confirmation cannot be empty.').notEmpty();
      req.assert('password', 'Your password must be at least 4 characters long.').len(4);
      req.assert('confirmPassword', 'Your passwords do not match.').equals(req.body.password);

      var errors = req.validationErrors();

      if (errors) {
        req.flash('errors', errors);
        return res.redirect('back');
      }

      // next step
      workflow.emit('verification');
    });

    /**
     * Step 2: Account verification step
     */

    workflow.on('verification', function () {

      var verified;
      var verifyToken;

      if (config.verificationRequired) {
        verified = false;
        // generate verification token
        crypto.randomBytes(25, function (err, buf) {
          verifyToken = buf.toString('hex');
          // next step
          workflow.emit('createUser', verified, verifyToken);
        });
      } else {
        verified = true;
        verifyToken = null;
        // next step
        workflow.emit('createUser', verified, verifyToken);
      }

    });

    /**
     * Step 3: Create a new account
     */

    workflow.on('createUser', function (verified, verifyToken) {

      // create user
      var user = new User({
        'profile.name': req.body.name.trim(),
        email:          req.body.email.toLowerCase(),
        password:       req.body.password,
        verifyToken:    verifyToken,
        verified:       verified
      });

      // save user
      user.save(function(err) {
        if (err) {
          if (err.code === 11000) {
            req.flash('errors', { msg: 'An account with that email address already exists!' });
            req.flash('info', { msg: 'You should sign in with that account.' });
          }
          return res.redirect('back');
        } else {
          if (config.verificationRequired) {
            // next step (4a)
            workflow.emit('sendValidateEmail', user, verifyToken);
          } else {
            // next step (4b)
            workflow.emit('sendWelcomeEmail', user);
          }
        }
      });

    });

    /**
     * Step 4a: Send them a validate email
     */

    workflow.on('sendValidateEmail', function (user, verifyToken) {

      // Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      var smtpTransport = nodemailer.createTransport('SMTP',{
        service: 'Gmail',
        auth: {
          user: config.gmail.user,
          pass: config.gmail.password
        }
      });

      // Render HTML to send using .jade mail template (just like rendering a page)
      res.render('mail/accountVerification', {
        name:          user.profile.name,
        mailtoName:    config.smtp.name,
        validateLink:  req.protocol + '://' + req.headers.host + '/verify/' + user.id + '/' + verifyToken
      }, function(err, html) {
        if (err) {
          return (err, null);
        }
        else {

          // Now create email text (multiline string as array FTW)
          var text = [
            'Hello ' + user.profile.name + '!',
            'Welcome to ' + app.locals.application + '!  Here is a special link to activate your new account:',
            req.protocol + '://' + req.headers.host + '/verify/' + user.id + '/' + user.verifyToken,
            '  - The ' + config.smtp.name + ' team'
          ].join('\n\n');

          // Create email
          var mailOptions = {
            to:       user.profile.name + ' <' + user.email + '>',
            from:     config.smtp.name + ' <' + config.smtp.address + '>',
            subject:  'Activate your new ' + app.locals.application + ' account',
            text:     text,
            html:     html
          };

          // send email via nodemailer
          smtpTransport.sendMail(mailOptions, function(err) {
            if (err) {
              req.flash('errors', { msg: err.message });
            }
            // shut down the connection pool, no more messages
            smtpTransport.close();
          });

        }
      });

      req.flash('info', { msg: 'Please check your email to verify your account. Thanks for signing up!' });
      res.redirect('/signup');

      // WORKFLOW COMPLETED

    });

    /**
     * Step 4b: Send them a welcome email
     */

    workflow.on('sendWelcomeEmail', function (user) {

      // Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      var smtpTransport = nodemailer.createTransport('SMTP',{
        service: 'Gmail',
        auth: {
          user: config.gmail.user,
          pass: config.gmail.password
        }
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
            subject:  'Welcome to ' + app.locals.application + '!',
            text:     text,
            html:     html
          };

          // send email via nodemailer
          smtpTransport.sendMail(mailOptions, function(err) {
            if (err) {
              req.flash('errors', { msg: err.message });
            }
            // shut down the connection pool, no more messages
            smtpTransport.close();
          });

        }
      });

      // next step
      workflow.emit('logUserIn', user);
    });

    /**
     * Step 5: Log them in
     */

    workflow.on('logUserIn', function (user) {

      // log the user in
      req.logIn(user, function(err) {
        if (err) {
          req.flash('errors', { msg: err.message });
          return res.redirect('back');
        }
        req.flash('info', { msg: 'Thanks for signing up! You rock!' });
        res.redirect('/api');
      });

      // WORKFLOW COMPLETED

    });

    /**
     * Initiate the workflow
     */

    workflow.emit('validate');

  });


  /**
   * GET /signupsocial
   * Confirm social email address
   */

  app.get('/signupsocial', function (req, res) {
    res.render('account/signupsocial', {
      url: req.url,
      email: ''
    });
  });

  /**
   * POST /signupsocial
   * Process a *Social* signup & confirm email address
   */

  app.post('/signupsocial', function (req, res, next) {

    // Begin a workflow
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the form fields
     */

    workflow.on('validate', function() {

      // Check for form errors
      req.assert('email', 'Your email cannot be empty.').notEmpty();
      req.assert('email', 'Your email is not valid.').isEmail();

      var errors = req.validationErrors();

      if (errors) {
        req.flash('errors', errors);
        return res.redirect('/signupsocial');
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
          req.flash('errors', { msg: 'Sorry that email address has already been used!' });
          req.flash('info', { msg: 'You can sign in with that account and link this provider, or you can create a new account by entering a different email address.' });
          return res.redirect('/signupsocial');
        }
      });

      // next step
      workflow.emit('createUser');
    });

    /**
     * Step 4: Create a new account
     */

    workflow.on('createUser', function () {

      var newUser = req.session.socialProfile;
      var user = new User();

      user.verified         = true;  // social users don't require verification
      user.email            = req.body.email.toLowerCase();
      user.profile.name     = newUser.profile.name;
      user.profile.gender   = newUser.profile.gender;
      user.profile.location = newUser.profile.location;
      user.profile.website  = newUser.profile.website;
      user.profile.picture  = newUser.profile.picture;

      if ( newUser.source === 'twitter' ) {
        user.twitter = newUser.id;
        user.tokens.push({ kind: 'twitter', token: newUser.token, tokenSecret: newUser.tokenSecret });

      } else if ( newUser.source === 'facebook'  ) {
        user.facebook = newUser.id;
        user.tokens.push({ kind: 'facebook', accessToken: newUser.accessToken, refreshToken: newUser.refreshToken });

      } else if ( newUser.source === 'github'  ) {
        user.github = newUser.id;
        user.tokens.push({ kind: 'github', accessToken: newUser.accessToken, refreshToken: newUser.refreshToken });

      } else if ( newUser.source === 'google'  ) {
        user.google = newUser.id;
        user.tokens.push({ kind: 'google', accessToken: newUser.accessToken, refreshToken: newUser.refreshToken });
      }

      // save user
      user.save(function(err) {
        if (err) {
          if (err.code === 11000) {
            req.flash('errors', { msg: 'An account with that email already exists!' });
          }
          return res.redirect('/signupsocial');
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
            subject:  'Welcome to ' + app.locals.application + '!',
            text:     text,
            html:     html
          };

          // send email via nodemailer
          smtpTransport.sendMail(mailOptions, function(err) {
            if (err) {
              req.flash('errors', { msg: err.message });
            }
            // shut down the connection pool, no more messages
            smtpTransport.close();
          });

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
   * Facebook Authentication
   */

  app.get('/auth/facebook',
    passport.authenticate('facebook', {
      callbackURL: '/auth/facebook/callback'
    })
  );

  app.get('/auth/facebook/callback', function (req, res, next) {
    passport.authenticate('facebook', {
      callbackURL: '/auth/facebook/callback',
      failureRedirect: '/login'
    }, function (err, user, info) {

      // Check for data
      if (!info || !info.profile) {
        req.flash('errors', { msg: 'We have no data. Something went wrong!' });
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

              // Send user on their merry way
              if (req.session.attemptedURL) {
                var redirectURL = req.session.attemptedURL;
                delete req.session.attemptedURL;
                return res.redirect(redirectURL);
              } else {
                return res.redirect('/api');
              }

            });
          });
        } else {
          // Brand new Facebook user!
          // Save their profile data into the session
          var newSocialUser               = {};

          newSocialUser.source            = 'facebook';
          newSocialUser.id                = info.profile._json.id;
          newSocialUser.accessToken       = info.accessToken;
          newSocialUser.refreshToken      = info.refreshToken;
          newSocialUser.email             = info.profile._json.email;

          newSocialUser.profile           = {};

          newSocialUser.profile.name      = info.profile._json.name;
          newSocialUser.profile.gender    = info.profile._json.gender;
          newSocialUser.profile.location  = info.profile._json.location.name;
          newSocialUser.profile.website   = info.profile._json.link;
          newSocialUser.profile.picture   = 'https://graph.facebook.com/' + info.profile.id + '/picture?type=large';

          req.session.socialProfile = newSocialUser;
          res.render('account/signupsocial', { email: newSocialUser.email });
        }
      });

    })(req, res, next);
  });

  /**
   * Github Authentication
   */

  app.get('/auth/github',
    passport.authenticate('github', {
      callbackURL: '/auth/github/callback'
    })
  );

  app.get('/auth/github/callback', function (req, res, next) {
    passport.authenticate('github', {
      callbackURL: '/auth/github/callback',
      failureRedirect: '/login'
    }, function (err, user, info) {
      if (!info || !info.profile) {
        req.flash('errors', { msg: 'We have no data. Something went wrong!' });
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

              // Send user on their merry way
              if (req.session.attemptedURL) {
                var redirectURL = req.session.attemptedURL;
                delete req.session.attemptedURL;
                return res.redirect(redirectURL);
              } else {
                return res.redirect('/api');
              }

            });
          });
        } else {
          // Brand new GitHub user!
          // Save their profile data into the session
          var newSocialUser               = {};

          newSocialUser.source            = 'github';
          newSocialUser.id                = info.profile._json.id;
          newSocialUser.accessToken       = info.accessToken;
          newSocialUser.refreshToken      = info.refreshToken;
          newSocialUser.email             = info.profile._json.email;

          newSocialUser.profile           = {};

          newSocialUser.profile.name      = info.profile._json.name;
          newSocialUser.profile.gender    = ''; // No gender from Github
          newSocialUser.profile.location  = info.profile._json.location;
          newSocialUser.profile.website   = info.profile._json.html_url;
          newSocialUser.profile.picture   = info.profile._json.avatar_url;

          req.session.socialProfile = newSocialUser;
          res.render('account/signupsocial', { email: newSocialUser.email });
        }
      });

    })(req, res, next);
  });

  /**
   * Google Authentication
   */

  app.get('/auth/google',
    passport.authenticate('google', {
      callbackURL: '/auth/google/callback'
    })
  );

  app.get('/auth/google/callback', function (req, res, next) {
    passport.authenticate('google', {
      callbackURL: '/auth/google/callback',
      failureRedirect: '/login'
    }, function (err, user, info) {
      if (!info || !info.profile) {
        req.flash('errors', { msg: 'We have no data. Something went wrong!' });
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

              // Send user on their merry way
              if (req.session.attemptedURL) {
                var redirectURL = req.session.attemptedURL;
                delete req.session.attemptedURL;
                return res.redirect(redirectURL);
              } else {
                return res.redirect('/api');
              }

            });
          });
        } else {
          // Brand new Google user!
          // Save their profile data into the session
          var newSocialUser               = {};

          newSocialUser.source            = 'google';
          newSocialUser.id                = info.profile.id;
          newSocialUser.accessToken       = info.accessToken;
          newSocialUser.refreshToken      = info.refreshToken;
          newSocialUser.email             = info.profile._json.email;

          newSocialUser.profile           = {};

          newSocialUser.profile.name      = info.profile._json.name;
          newSocialUser.profile.gender    = info.profile._json.gender;
          newSocialUser.profile.location  = ''; // No location from Google
          newSocialUser.profile.website   = info.profile._json.link;
          newSocialUser.profile.picture   = info.profile._json.picture;

          req.session.socialProfile = newSocialUser;
          res.render('account/signupsocial', { email: newSocialUser.email });
        }
      });

    })(req, res, next);
  });

  /**
   * Twitter Authentication
   */

  app.get('/auth/twitter',
    passport.authenticate('twitter', {
      callbackURL: '/auth/twitter/callback',
    })
  );

  app.get('/auth/twitter/callback', function (req, res, next) {
    passport.authenticate('twitter', {
      callbackURL: '/auth/twitter/callback',
      failureRedirect: '/login'
    }, function (err, user, info) {
      if (!info || !info.profile) {
        req.flash('errors', { msg: 'We have no data. Something went wrong!' });
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

              // Send user on their merry way
              if (req.session.attemptedURL) {
                var redirectURL = req.session.attemptedURL;
                delete req.session.attemptedURL;
                return res.redirect(redirectURL);
              } else {
                return res.redirect('/api');
              }

            });
          });
        } else {
          // Brand new Twitter user!
          // Save their profile data into the session
          var newSocialUser               = {};

          newSocialUser.source            = 'twitter';
          newSocialUser.id                = info.profile.id;
          newSocialUser.token             = info.token;
          newSocialUser.tokenSecret       = info.tokenSecret;
          newSocialUser.email             = '';  // Twitter does not provide email addresses

          newSocialUser.profile           = {};

          newSocialUser.profile.name      = info.profile._json.name;
          newSocialUser.profile.gender    = '';  // No gender from Twitter either
          newSocialUser.profile.location  = info.profile._json.location;
          newSocialUser.profile.website   = info.profile._json.entities.url.urls[0].expanded_url;
          newSocialUser.profile.picture   = info.profile._json.profile_image_url;

          req.session.socialProfile = newSocialUser;
          res.render('account/signupsocial', { email: newSocialUser.email });
        }
      });

    })(req, res, next);
  });

};
