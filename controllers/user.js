'use strict';

/**
 * Module Dependencies
 */

var passport      = require('passport');
var User          = require('../models/User');

/**
 * User Controller
 */

module.exports.controller = function(app) {

  app.get('/login', function(req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    res.render('account/login', {
      url: req.url
    });
  });

  app.post('/login', function(req, res, next) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password cannot be blank').notEmpty();
    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/login');
    }

    passport.authenticate('local', function(err, user, info) {
      if (err) {
        return next(err);
      }
      if (!user) {
        req.flash('errors', { msg: info.message });
        return res.redirect('/login');
      }

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

    })(req, res, next);

  });

  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
  });

  app.get('/signup', function(req, res) {
    if (req.user) {
      return res.redirect('/');
    }
    res.render('account/signup', {
      url: req.url
    });
  });

  app.post('/signup', function(req, res, next) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password must be at least 4 characters long').len(4);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/signup');
    }

    var user = new User({
      'profile.name': req.body.name,
      email: req.body.email,
      password: req.body.password
    });

    user.save(function(err) {
      if (err) {
        if (err.code === 11000) {
          req.flash('errors', { msg: 'User with that email already exists.' });
        }
        return res.redirect('/signup');
      }
      req.logIn(user, function(err) {
        if (err) {
          return next(err);
        }
        req.flash('info', { msg: 'Thanks for signing up! You rock!' });
        res.redirect('/api');
      });
    });

  });

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
