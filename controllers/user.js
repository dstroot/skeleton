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
      return res.redirect('/');
    }
    // Turn off login form if too many attempts
    var tooManyAttempts = req.session.tooManyAttempts;
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
   *
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

  /**
   * GET /auth/twitter/callback
   * Process Twitter Authorization
   */

  // app.get('/auth/twitter', passport.authenticate('twitter'));
  // app.get('/auth/twitter/callback', function (req, res) {


  //   // From Drywall
  //   req._passport.instance.authenticate('twitter', function(err, user, info) {
  //     if (!info || !info.profile) {
  //       return res.redirect('/signup/');
  //     }
  //     req.app.db.models.User.findOne({ 'twitter.id': info.profile._json.id }, function(err, user) {
  //       if (err) {
  //         return next(err);
  //       }
  //       if (!user) {
  //         // Since we didn't find an existing user we have a brand new one
  //         // Save thier profile data into the session
  //         req.session.socialProfile = info.profile;
  //         // Twitter does NOT provide an email address
  //         res.render('signup/social', { email: '' });
  //       }
  //       else {
  //         res.render('signup/index', {
  //           oauthMessage: 'We found a user linked to your Twitter account.',
  //           oauthTwitter: !!req.app.get('twitter-oauth-key'),
  //           oauthGitHub: !!req.app.get('github-oauth-key'),
  //           oauthGoogle: !!req.app.get('google-oauth-key'),
  //           oauthFacebook: !!req.app.get('facebook-oauth-key')
  //         });
  //       }
  //     });
  //   })(req, res, next);


  //   // From Skeleton
  //   passport.use(new TwitterStrategy(config.twitter, function (req, accessToken, tokenSecret, profile, done) {
  //     if (req.user) {
  //       User.findOne({ twitter: profile.id }, function(err, existingUser) {
  //         if (existingUser) {
  //           req.flash('errors', { msg: 'There is already a Twitter account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
  //           done(err);
  //         } else {
  //           User.findById(req.user.id, function(err, user) {
  //             user.twitter = profile.id;
  //             user.tokens.push({ kind: 'twitter', accessToken: accessToken, tokenSecret: tokenSecret });
  //             user.profile.name = user.profile.name || profile.displayName;
  //             user.profile.location = user.profile.location || profile._json.location;
  //             user.profile.picture = user.profile.picture || profile._json.profile_image_url;
  //             user.save(function(err) {
  //               req.flash('info', { msg: 'Twitter account has been linked.' });
  //               done(err, user);
  //             });
  //           });
  //         }
  //       });
  //     } else {
  //       User.findOne({ twitter: profile.id }, function (err, existingUser) {
  //         if (existingUser) {
  //           // update the user's record with login timestamp
  //           existingUser.activity.last_logon = Date.now();
  //           existingUser.save(function (err) {
  //             if (err) {
  //               return (err);
  //             }
  //           });
  //           return done(null, existingUser);
  //         } else {
  //           // TODO

  //           // Ideally here we would grab all thier data and save it into the session
  //           // then go to another page where they can enter/confirm their email address
  //           // THEN save their account
  //           // ===========================================================
  //           // // Save their profile data into the session
  //           // req.session.socialProfile = profile;
  //           // // Twitter does NOT provide an email address
  //           // res.render('account/confirmEmail', { email: 'dan@thestroots.com' });
  //           // ========= this would move the steps below until the next page

  //           // BRAND NEW USER!
  //           var user = new User();
  //           // Twitter will not provide an email address.  Period.
  //           // But a person’s twitter username is guaranteed to be unique
  //           // so we can "fake" a twitter email address as follows:
  //           user.email = profile.username + '@twitter.com';
  //           user.twitter = profile.id;
  //           user.tokens.push({ kind: 'twitter', accessToken: accessToken, tokenSecret: tokenSecret });
  //           user.profile.name = profile.displayName;
  //           user.profile.location = profile._json.location;
  //           user.profile.picture = profile._json.profile_image_url;
  //           user.save(function(err) {
  //             done(err, user);
  //           });
  //         }
  //       });
  //     }
  //   }));
  // });

  /**
   * OAuth routes for sign-in.
   */

  app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_location'] }));
  app.get('/auth/facebook/callback', passport.authenticate('facebook', { successRedirect: '/api',
                                                                         failureRedirect: '/login' }));

  app.get('/auth/github', passport.authenticate('github'));
  app.get('/auth/github/callback', passport.authenticate('github', { successRedirect: '/api',
                                                                     failureRedirect: '/login' }));

  app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
  app.get('/auth/google/callback', passport.authenticate('google', { successRedirect: '/api',
                                                                     failureRedirect: '/login' }));

  app.get('/auth/twitter', passport.authenticate('twitter'));
  app.get('/auth/twitter/callback', passport.authenticate('twitter', { successRedirect: '/api',
                                                                       failureRedirect: '/login' }));

};
