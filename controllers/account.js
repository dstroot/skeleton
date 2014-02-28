'use strict';

/**
 * Module Dependences
 */

var _             = require('underscore');
var User          = require('../models/User');
var passport      = require('passport');
var passportConf  = require('../config/passport');


/**
 * Account Controller
 */

module.exports.controller = function(app) {

 /**
   * GET /account*
   * *ALL* acount routes must be authenticated first
   */

  app.all('/account*', passportConf.isAuthenticated);

  /**
   * GET /account
   * Render User Profile Page
   */

  app.get('/account', function(req, res) {
    res.render('account/profile', {
      url: req.url
    });
  });

 /**
   * POST /account
   * Update User Profile Information
   */

  app.post('/account/profile', function(req, res, next) {
    User.findById(req.user.id, function(err, user) {
      if (err) {
        return next(err);
      }
      user.email = req.body.email || '';
      user.profile.name = req.body.name || '';
      user.profile.gender = req.body.gender || '';
      user.profile.location = req.body.location || '';
      user.profile.website = req.body.website || '';
      user.activity.last_updated = Date.now();

      user.save(function(err) {
        if (err) {
          return next(err);
        }
        req.flash('success', { msg: 'Profile information updated.' });
        res.redirect('/account');
      });
    });
  });

  /**
   * POST /account/password
   * Update User Password
   */

  app.post('/account/password', function(req, res, next) {
    req.assert('password', 'Password must be at least 4 characters long').len(4);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/account');
    }

    User.findById(req.user.id, function(err, user) {
      if (err) {
        return next(err);
      }

      user.password = req.body.password;
      user.activity.last_updated = Date.now();

      user.save(function(err) {
        if (err) {
          return next(err);
        }
        req.flash('success', { msg: 'Password has been changed.' });
        res.redirect('/account');
      });
    });

  });

  /**
   * POST /account/delete
   * Delete User Account
   */

  app.post('/account/delete', function(req, res, next) {
    User.remove({ _id: req.user.id }, function(err) {
      if (err) {
        return next(err);
      }
      req.logout();
      res.redirect('/');
    });
  });

 /**
   * GET /account/unlink/:provider
   * Unlink a social account
   */

  app.get('/account/unlink/:provider', function(req, res, next) {
    var provider = req.params.provider;
    User.findById(req.user.id, function(err, user) {
      if (err) {
        return next(err);
      }

      user[provider] = undefined;
      user.tokens = _.reject(user.tokens, function(token) { return token.kind === provider; });
      user.activity.last_updated = Date.now();

      user.save(function(err) {
        if (err) {
          return next(err);
        }
        // to capitalize the provider name
        String.prototype.capitalize = function() {
          return this.charAt(0).toUpperCase() + this.slice(1);
        };

        req.flash('info', { msg: provider.capitalize() + ' has been unlinked.' });
        res.redirect('/account');
      });
    });
  });

 /**
   * GET /account/link/:provider
   * Link a social account
   */

  app.get('/account/link/facebook',
    passport.authenticate('facebook', {
      callbackURL: '/account/link/facebook/callback'
    })
  );

  app.get('/account/link/facebook/callback',
    passport.authenticate('facebook', {
      callbackURL: '/account/link/facebook/callback',
      successRedirect: '/account',
      failureRedirect: '/account'
    })
  );

  app.get('/account/link/twitter',
    passport.authenticate('twitter', {
      callbackURL: '/account/link/twitter/callback'
    })
  );

  app.get('/account/link/twitter/callback',
    passport.authenticate('twitter', {
      callbackURL: '/account/link/twitter/callback',
      successRedirect: '/account',
      failureRedirect: '/account'
    })
  );
  app.get('/account/link/github',
    passport.authenticate('github', {
      callbackURL: '/account/link/github/callback'
    })
  );

  app.get('/account/link/github/callback',
    passport.authenticate('github', {
      callbackURL: '/account/link/github/callback',
      successRedirect: '/account',
      failureRedirect: '/account'
    })
  );

  app.get('/account/link/google',
    passport.authenticate('google', {
      callbackURL: '/account/link/google/callback'
    })
  );

  app.get('/account/link/google/callback',
    passport.authenticate('google', {
      callbackURL: '/account/link/google/callback',
      successRedirect: '/account',
      failureRedirect: '/account'
    })
  );
};
