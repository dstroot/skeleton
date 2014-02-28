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
        req.flash('info', { msg: 'Your ' + provider.capitalize() + ' account has been unlinked. :(' });
        res.redirect('/account');
      });
    });
  });

  /**
   * Link Facebook
   */

  app.get('/account/link/facebook',
    passport.authenticate('facebook', {
      callbackURL: '/account/link/facebook/callback'
    })
  );

  app.get('/account/link/facebook/callback', function (req, res, next) {
    passport.authenticate('facebook', { callbackURL: '/account/link/facebook/callback' }, function (err, user, info) {

      // We have a user linking their Facebook account
      // Let's check to make sure we don't already have an account with same id
      User.findOne({ facebook: info.profile._json.id }, function (err, existingUser) {
        if (existingUser) {
          req.flash('errors', { msg: 'We already have your Facebook account linked to another account! Sign out, then sign in with that account to delete it. Then sign back in with this account and link your Facebook account.' });
          return res.redirect('/account');
        } else {
          // Link Accounts: Associate the *new* Facebook information to the persons *existing* account
          User.findById(req.user.id, function(err, user) {

            user.facebook = info.profile.id;
            user.tokens.push({ kind: 'facebook', accessToken: info.accessToken });
            user.profile.name = user.profile.name || info.profile._json.name;
            user.profile.gender = user.profile.gender || info.profile._json.gender;
            user.profile.picture = user.profile.picture || 'https://graph.facebook.com/' + info.profile.id + '/picture?type=large';
            user.profile.location = user.profile.location || info.profile._json.location.name;

            user.save(function (err) {
              if (err) {
                return next(err);
              }
              req.flash('info', { msg: 'Your Facebook account has been linked! :)' });
              return res.redirect('/account');
            });
          });
        }
      });

    })(req, res, next);
  });

  /**
   * Link Twitter
   */

  app.get('/account/link/twitter',
    passport.authenticate('twitter', {
      callbackURL: '/account/link/twitter/callback'
    })
  );

  app.get('/account/link/twitter/callback', function (req, res, next) {
    passport.authenticate('twitter', { callbackURL: '/account/link/twitter/callback' }, function (err, user, info) {

      // We have a user linking their Twitter account
      // Let's check to make sure we don't already have an account with same id
      User.findOne({ twitter: info.profile._json.id }, function (err, existingUser) {
        if (existingUser) {
          req.flash('errors', { msg: 'We already have your Twitter account linked to another account! Sign out, then sign in with that account to delete it. Then sign back in with this account and link your Twitter account.' });
          return res.redirect('/account');
        } else {
          // Link Accounts: Associate the *new* Twitter information to the persons *existing* account
          User.findById(req.user.id, function(err, user) {

            user.twitter = info.profile.id;
            user.tokens.push({ kind: 'twitter', accessToken: info.accessToken, tokenSecret: info.tokenSecret });
            user.profile.name = user.profile.name || info.profile._json.name;
            user.profile.location = user.profile.location || info.profile._json.location;
            user.profile.picture = user.profile.picture || info.profile._json.profile_image_url;

            user.save(function (err) {
              if (err) {
                return next(err);
              }
              req.flash('info', { msg: 'Your Twitter account has been linked! :)' });
              return res.redirect('/account');
            });
          });
        }
      });

    })(req, res, next);
  });

  /**
   * Link Github
   */

  app.get('/account/link/github',
    passport.authenticate('github', {
      callbackURL: '/account/link/github/callback'
    })
  );

  app.get('/account/link/github/callback', function (req, res, next) {
    passport.authenticate('github', { callbackURL: '/account/link/github/callback' }, function (err, user, info) {

      // We have a user linking their GitHub account
      // Let's check to make sure we don't already have an account with same id
      User.findOne({ github: info.profile._json.id }, function (err, existingUser) {
        if (existingUser) {
          req.flash('errors', { msg: 'We already have your GitHub account linked to another account! Sign out, then sign in with that account to delete it. Then sign back in with this account and link your GitHub account.' });
          return res.redirect('/account');
        } else {
          // Link Accounts: Associate the *new* GitHub information to the persons *existing* account
          User.findById(req.user.id, function(err, user) {

            user.github = info.profile.id;
            user.tokens.push({ kind: 'github', accessToken: info.accessToken });
            user.profile.name = user.profile.name || info.profile._json.name;
            user.profile.picture = user.profile.picture || info.profile._json.avatar_url;
            user.profile.location = user.profile.location || info.profile._json.location;
            user.profile.website = user.profile.website || info.profile._json.html_url;

            user.save(function (err) {
              if (err) {
                return next(err);
              }
              req.flash('info', { msg: 'Your GitHub account has been linked! :)' });
              return res.redirect('/account');
            });
          });
        }
      });

    })(req, res, next);
  });

  /**
   * Link Google
   */

  app.get('/account/link/google',
    passport.authenticate('google', {
      callbackURL: '/account/link/google/callback'
    })
  );

  app.get('/account/link/google/callback', function (req, res, next) {
    passport.authenticate('google', { callbackURL: '/account/link/google/callback' }, function (err, user, info) {

      // We have a user linking their Google account
      // Let's check to make sure we don't already have an account with same id
      User.findOne({ google: info.profile._json.id }, function (err, existingUser) {
        if (existingUser) {
          req.flash('errors', { msg: 'We already have your Google account linked to another account! Sign out, then sign in with that account to delete it. Then sign back in with this account and link your Google account.' });
          return res.redirect('/account');
        } else {
          // Link Accounts: Associate the *new* Google information to the persons *existing* account
          User.findById(req.user.id, function(err, user) {

            user.google = info.profile.id;
            user.tokens.push({ kind: 'google', accessToken: info.accessToken });
            user.profile.name = user.profile.name || info.profile._json.name;
            user.profile.gender = user.profile.gender || info.profile._json.gender;
            user.profile.website = user.profile.website || info.profile._json.link;
            user.profile.picture = user.profile.picture || info.profile._json.picture;

            user.save(function (err) {
              if (err) {
                return next(err);
              }
              req.flash('info', { msg: 'Your Google account has been linked! :)' });
              return res.redirect('/account');
            });
          });
        }
      });

    })(req, res, next);
  });

};
