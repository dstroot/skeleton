'use strict';

/**
 * Module dependencies.
 */

var _                 = require('underscore');
var User              = require('../models/User');
var utils             = require('./utils');
var config            = require('./config');
var passport          = require('passport');
var TotpStrategy      = require('passport-totp').Strategy;
var LocalStrategy     = require('passport-local').Strategy;
var OAuthStrategy     = require('passport-oauth').OAuthStrategy;
var OAuth2Strategy    = require('passport-oauth').OAuth2Strategy;
var GitHubStrategy    = require('passport-github').Strategy;
var GoogleStrategy    = require('passport-google-oauth').OAuth2Strategy;
var TwitterStrategy   = require('passport-twitter').Strategy;
var FacebookStrategy  = require('passport-facebook').Strategy;

/**
 * Serialize and Deserialize the User
 */

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

/**
 * Local authentication
 */

// Use the LocalStrategy within Passport.
//   Strategies in passport accept credentials (in this case, a username and password),
//   and invoke a callback with a user object.

passport.use(new LocalStrategy({ usernameField: 'email' }, function (email, password, done) {
  User.findOne({ email: email }, function(err, user) {
    if (!user) {
      return done(null, false, { message: 'Invalid email or password.' });
    }

    // Only authenticate if the user is verified
    if (user.verified) {
      user.comparePassword(password, function(err, isMatch) {
        if (isMatch) {

          // update the user's record with login timestamp
          user.activity.last_logon = Date.now();
          user.save(function(err) {
            if (err) {
              return (err);
            }
          });

          return done(null, user);
        } else {
          return done(null, false, { message: 'Invalid email or password.' });
        }
      });
    } else {
      return done(null, false, { message: 'Your account must be verified first!' });
    }
  });
}));

/**
 *
 */

var keys = {};

exports.findKeyForUserId = function (id, fn) {
  return fn(null, keys[id]);
};

exports.saveKeyForUserId = function (id, key, fn) {
  keys[id] = key;
  return fn(null);
};

exports.ensureSecondFactor = function (req, res, next) {
  if (req.session.secondFactor === 'totp') {
    return next();
  }
  res.redirect('/login-otp');
};

passport.use(new TotpStrategy(
  function(user, done) {
    // setup function, supply key and period to done callback
    findKeyForUserId(user.id, function (err, obj) {
      if (err) {
        return done(err);
      }
      return done(null, obj.key, obj.period);
    });
  }
));

/**
 * Sign in with Facebook.
 */

passport.use('facebook', new FacebookStrategy({
  clientID: config.facebook.clientID,
  clientSecret: config.facebook.clientSecret,
  scope: ['email', 'user_location']
}, function (accessToken, refreshToken, profile, done) {
    done(null, false, {
      accessToken: accessToken,
      refreshToken: refreshToken,
      profile: profile
    });
  }
));

/**
 * Sign in with GitHub.
 */

passport.use('github', new GitHubStrategy({
  clientID: config.github.clientID,
  clientSecret: config.github.clientSecret,
  customHeaders: { 'User-Agent': config.name }
}, function (accessToken, refreshToken, profile, done) {
    done(null, false, {
      accessToken: accessToken,
      refreshToken: refreshToken,
      profile: profile
    });
  }
));

/**
 * Sign in with Twitter. (OAuth 1.0a)
 * NOTE: different function args!
 */

passport.use('twitter', new TwitterStrategy({
  consumerKey: config.twitter.consumerKey,
  consumerSecret: config.twitter.consumerSecret
}, function (token, tokenSecret, profile, done) {
    done(null, false, {
      token: token,
      tokenSecret: tokenSecret,
      profile: profile
    });
  }
));

/**
 * Sign in with Google. (OAuth 2.0)
 */

passport.use('google', new GoogleStrategy({
  clientID: config.google.clientID,
  clientSecret: config.google.clientSecret,
  scope: ['profile email']  // get the user's email address
}, function (accessToken, refreshToken, profile, done) {
    done(null, false, {
      accessToken: accessToken,
      refreshToken: refreshToken,
      profile: profile
    });
  }
));

/**
 * Tumblr API
 * Uses OAuth 1.0a Strategy.
 */

passport.use('tumblr', new OAuthStrategy({
    requestTokenURL: 'http://www.tumblr.com/oauth/request_token',
    accessTokenURL: 'http://www.tumblr.com/oauth/access_token',
    userAuthorizationURL: 'http://www.tumblr.com/oauth/authorize',
    consumerKey: config.tumblr.key,
    consumerSecret: config.tumblr.secret,
    callbackURL: config.tumblr.callbackURL,
    passReqToCallback: true
  },
  function (req, token, tokenSecret, profile, done) {
    User.findById(req.user._id, function(err, user) {
      user.tokens.push({ kind: 'tumblr', token: token, tokenSecret: tokenSecret });
      user.save(function(err) {
        done(err, user);
      });
    });
  }
));

/**
 * Foursquare API
 * Uses OAuth 2.0 Strategy.
 */

passport.use('foursquare', new OAuth2Strategy({
    authorizationURL: 'https://foursquare.com/oauth2/authorize',
    tokenURL: 'https://foursquare.com/oauth2/access_token',
    clientID: config.foursquare.clientId,
    clientSecret: config.foursquare.clientSecret,
    callbackURL: config.foursquare.redirectUrl,
    passReqToCallback: true
  },
  function (req, accessToken, refreshToken, profile, done) {
    User.findById(req.user._id, function(err, user) {
      user.tokens.push({ kind: 'foursquare', accessToken: accessToken });
      user.save(function(err) {
        done(err, user);
      });
    });
  }
));

/**
 * Login Required middleware.
 */

exports.isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.session.attemptedURL = req.url;  // Save URL so we can redirect to it after authentication
    res.set('X-Auth-Required', 'true');
    req.flash('errors', { msg: 'You must be logged in to reach that page.' });
    res.redirect('/login');
  }
};

/**
 * Authorization Required middleware.
 */

exports.isAuthorized = function (req, res, next) {
  var provider = req.path.split('/').slice( -1 )[0];
  if (_.findWhere(req.user.tokens, { kind: provider })) {
    // we found the provider so just continue
    next();
  } else {
    // we have to get authorized first
    if ( provider === 'facebook' || provider === 'twitter' || provider === 'github' || provider === 'google' ) {
      req.flash('info', { msg: 'You must connect ' + utils.capitalize(provider) + ' first!' });
      res.redirect('/account');
    } else {
      res.redirect('/auth/' + provider);
    }
  }
};

/**
 * Check if the account is an Administrator
 */

exports.isAdministrator = function (req, res, next) {
  // make sure we are logged in first
  if (req.isAuthenticated()) {
    //user must be be an administrator
    if (req.user.type !== 'admin') {
      req.flash('errors', { msg: 'You must be an Administrator reach that page.' });
      return res.redirect('/api');
    } else {
      return next();
    }
  } else {
    req.flash('errors', { msg: 'You must be logged in to reach that page.' });
    res.redirect('/login');
  }
};

