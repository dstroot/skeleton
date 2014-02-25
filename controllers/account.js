'use strict';

/**
 * Module Dependences
 */

var _             = require('underscore');
var User          = require('../models/User');
var passportConf  = require('../config/passport');

/**
 * Account Controller
 */

module.exports.controller = function(app) {

  /**
   * GET /account
   * Render User Profile Page
   */

  app.get('/account', passportConf.isAuthenticated, function(req, res) {
    res.render('account/profile', {
      url: req.url
    });
  });

 /**
   * POST /account
   * Update User Profile Information
   */

  app.post('/account/profile', passportConf.isAuthenticated, function(req, res, next) {
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

  app.post('/account/password', passportConf.isAuthenticated, function(req, res, next) {
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

  app.post('/account/delete', passportConf.isAuthenticated, function(req, res, next) {
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

  app.get('/account/unlink/:provider', passportConf.isAuthenticated, function(req, res, next) {
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
        req.flash('info', { msg: provider + ' account has been unlinked.' });
        res.redirect('/account');
      });
    });
  });

};
