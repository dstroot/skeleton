'use strict';

/**
 * Module dependencies.
 */

var _                 = require('underscore');
var User              = require('../models/User');
var config            = require('./config');
var passport          = require('passport');
var LocalStrategy     = require('passport-local').Strategy;
var OAuthStrategy     = require('passport-oauth').OAuthStrategy;
var OAuth2Strategy    = require('passport-oauth').OAuth2Strategy;
var FacebookStrategy  = require('passport-facebook').Strategy;
var TwitterStrategy   = require('passport-twitter').Strategy;
var GitHubStrategy    = require('passport-github').Strategy;
var GoogleStrategy    = require('passport-google-oauth').OAuth2Strategy;

/**
 * Serialize and Deserialize the User
 */

passport.serializeUser(function(user, done) {
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

passport.use(new LocalStrategy({ usernameField: 'email' }, function(email, password, done) {
  User.findOne({ email: email }, function(err, user) {
    if (!user) {
      return done(null, false, { message: 'Email ' + email + ' not found'});
    }
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
  });
}));

/**
 * Sign in with Facebook.
 */

passport.use(new FacebookStrategy(config.facebook, function(req, accessToken, refreshToken, profile, done) {
  if (req.user) {
    User.findOne({ $or: [{ facebook: profile.id }, { email: profile.email }] }, function(err, existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Facebook account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, function(err, user) {
          user.facebook = profile.id;
          user.tokens.push({ kind: 'facebook', accessToken: accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture = user.profile.picture || 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
          user.profile.location = user.profile.location || profile._json.location.name;
          user.save(function(err) {
            req.flash('info', { msg: 'Facebook account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ facebook: profile.id }, function(err, existingUser) {
      if (existingUser) {
        // update the user's record with login timestamp
        existingUser.activity.last_logon = Date.now();
        existingUser.save(function(err) {
          if (err) {
            return (err);
          }
        });
        return done(null, existingUser);
      }
      var user = new User();
      user.email = profile._json.email;
      user.facebook = profile.id;
      user.tokens.push({ kind: 'facebook', accessToken: accessToken });
      user.profile.name = profile.displayName;
      user.profile.gender = profile._json.gender;
      user.profile.picture = 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
      user.profile.location = (profile._json.location) ? profile._json.location.name : '';
      user.save(function(err) {
        done(err, user);
      });
    });
  }
}));

/**
 * Sign in with GitHub.
 */

passport.use(new GitHubStrategy(config.github, function(req, accessToken, refreshToken, profile, done) {
  if (req.user) {
    User.findOne({ $or: [{ github: profile.id }, { email: profile.email }] }, function(err, existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a GitHub account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, function(err, user) {
          user.github = profile.id;
          user.tokens.push({ kind: 'github', accessToken: accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.picture = user.profile.picture || profile._json.avatar_url;
          user.profile.location = user.profile.location || profile._json.location;
          user.profile.website = user.profile.website || profile._json.blog;
          user.save(function(err) {
            req.flash('info', { msg: 'GitHub account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ github: profile.id }, function(err, existingUser) {
      if (existingUser) {
        // update the user's record with login timestamp
        existingUser.activity.last_logon = Date.now();
        existingUser.save(function(err) {
          if (err) {
            return (err);
          }
        });
        return done(null, existingUser);
      }
      var user = new User();
      user.email = profile._json.email;
      user.github = profile.id;
      user.tokens.push({ kind: 'github', accessToken: accessToken });
      user.profile.name = profile.displayName;
      user.profile.picture = profile._json.avatar_url;
      user.profile.location = profile._json.location;
      user.profile.website = profile._json.blog;
      user.save(function(err) {
        done(err, user);
      });
    });
  }
}));

/**
 * Sign in with Twitter.
 */

passport.use(new TwitterStrategy(config.twitter, function(req, accessToken, tokenSecret, profile, done) {
  if (req.user) {
    User.findOne({ twitter: profile.id }, function(err, existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Twitter account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, function(err, user) {
          user.twitter = profile.id;
          user.tokens.push({ kind: 'twitter', accessToken: accessToken, tokenSecret: tokenSecret });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.location = user.profile.location || profile._json.location;
          user.profile.picture = user.profile.picture || profile._json.profile_image_url;
          user.save(function(err) {
            req.flash('info', { msg: 'Twitter account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ twitter: profile.id }, function(err, existingUser) {
      if (existingUser) {
        // update the user's record with login timestamp
        existingUser.activity.last_logon = Date.now();
        existingUser.save(function(err) {
          if (err) {
            return (err);
          }
        });
        return done(null, existingUser);
      } else {
        // TODO

        // Ideally here we would grab all thier data and save it into the session
        // then go to another page where they can enter/confirm their email address
        // THEN save their account
        // ===========================================================
        // // Save their profile data into the session
        // req.session.socialProfile = profile;
        // // Twitter does NOT provide an email address
        // res.render('account/confirmEmail', { email: 'dan@thestroots.com' });
        // ========= this would move the steps below until the next page

        // BRAND NEW USER!
        var user = new User();
        // Twitter will not provide an email address.  Period.
        // But a person’s twitter username is guaranteed to be unique
        // so we can "fake" a twitter email address as follows:
        user.email = profile.username + '@twitter.com';
        user.twitter = profile.id;
        user.tokens.push({ kind: 'twitter', accessToken: accessToken, tokenSecret: tokenSecret });
        user.profile.name = profile.displayName;
        user.profile.location = profile._json.location;
        user.profile.picture = profile._json.profile_image_url;
        user.save(function(err) {
          done(err, user);
        });
      }
    });
  }
}));

/**
 * Sign in with Google.
 */

passport.use(new GoogleStrategy(config.google, function(req, accessToken, refreshToken, profile, done) {
  if (req.user) {
    User.findOne({ $or: [{ google: profile.id }, { email: profile.email }] }, function(err, existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Google account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, function(err, user) {
          user.google = profile.id;
          user.tokens.push({ kind: 'google', accessToken: accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture = user.profile.picture || profile._json.picture;
          user.save(function(err) {
            req.flash('info', { msg: 'Google account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ google: profile.id }, function(err, existingUser) {
      if (existingUser) {
        // update the user's record with login timestamp
        existingUser.activity.last_logon = Date.now();
        existingUser.save(function(err) {
          if (err) {
            return (err);
          }
        });
        return done(null, existingUser);
      }
      var user = new User();
      user.email = profile._json.email;
      user.google = profile.id;
      user.tokens.push({ kind: 'google', accessToken: accessToken });
      user.profile.name = profile.displayName;
      user.profile.gender = profile._json.gender;
      user.profile.picture = profile._json.picture;
      user.save(function(err) {
        done(err, user);
      });
    });
  }
}));

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
      user.tokens.push({ kind: 'tumblr', accessToken: token, tokenSecret: tokenSecret });
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

exports.isAuthenticated = function(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash('errors', { msg: 'You must be logged in to reach that page.' });
    res.redirect('/login');
  }
};

/**
 * Authorization Required middleware.
 */

exports.isAuthorized = function(req, res, next) {
  var provider = req.path.split('/').slice( -1 )[0];
  if (_.findWhere(req.user.tokens, { kind: provider })) {
    next();
  } else {
    res.redirect('/auth/' + provider);
  }
};

/**
 * Check if the account is an Administrator
 */

exports.isAdministrator = function(req, res, next) {
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

