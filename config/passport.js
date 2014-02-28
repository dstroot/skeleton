'use strict';

/**
 * Module dependencies.
 */

var _                 = require('underscore');
var pkg               = require('../package.json');
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

passport.use(new LocalStrategy({ usernameField: 'email' }, function (email, password, done) {
  User.findOne({ email: email }, function(err, user) {
    if (!user) {
      return done(null, false, { message: 'Invalid email or password.' });
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

passport.use(new FacebookStrategy({
  clientID: config.facebook.clientID,
  clientSecret: config.facebook.clientSecret,
  scope: ['email', 'user_location'],  // get the user's email address and location
  passReqToCallback: true
}, function (req, accessToken, refreshToken, profile, done) {
  if (req.user) { // User already logged in!

    // So we must have a [user linking their facebook account]
    // Let's check to make sure we don't already have an account with same facebook id
    // User.findOne({ $or: [{ facebook: profile.id }, { email: profile.email }] }, function(err, existingUser) {
    User.findOne({ facebook: profile.id }, function (err, existingFacebookUser) {
      if (existingFacebookUser) {
        req.flash('errors', { msg: 'We already have your Facebook account linked to another account! Sign out, then sign in with that account to delete it. Then sign back in with this account and link your Facebook account.' });
        done(err);
      } else {
        // Link Accounts: Associate the *new* Facebook information to the persons *existing* account
        User.findById(req.user.id, function(err, user) {
          user.facebook = profile.id;
          user.tokens.push({ kind: 'facebook', accessToken: accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture = user.profile.picture || 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
          user.profile.location = user.profile.location || profile._json.location.name;
          user.save(function (err) {
            if (err) {
              return done(err, null);
            }
            req.flash('info', { msg: 'Your Facebook account has been linked! :)' });
            done(err, user);
          });
        });
      }
    });

  } else { // Either we have a [brand new user!] or [simply a social login]

    // Do we have an existing user with the same email? If so, just link the account.
    User.findOne({ email: profile._json.email, facebook: { $exists: false } }, function (err, existingUser) {
      if (err) {
        return (err);
      }
      if (existingUser) {  // Associate the new Facebook information to the persons account
        existingUser.facebook = profile.id;
        existingUser.tokens.push({ kind: 'facebook', accessToken: accessToken });
        existingUser.profile.name = existingUser.profile.name || profile.displayName;
        existingUser.profile.gender = existingUser.profile.gender || profile._json.gender;
        existingUser.profile.picture = existingUser.profile.picture || 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
        existingUser.profile.location = existingUser.profile.location || profile._json.location.name;
        existingUser.save(function (err) {
          if (err) {
            return done(err, null);
          }
          req.flash('info', { msg: 'Your Facebook account has been linked to your existing account!' });
          done(null, existingUser);
        });
      }
    });

    // Do we already have this Facebook user?  Then it's just a login.
    User.findOne({ facebook: profile.id }, function (err, justLogin) {
      if (justLogin) {
        // update the user's record with login timestamp
        justLogin.activity.last_logon = Date.now();
        justLogin.save(function(err) {
          if (err) {
            return (err);
          }
        });
        return done(null, justLogin);
      } else { // We have a brand new Facebook user!
        var user = new User();
        user.email = profile._json.email;
        user.facebook = profile.id;
        user.tokens.push({ kind: 'facebook', accessToken: accessToken });
        user.profile.name = profile.displayName;
        user.profile.gender = profile._json.gender;
        user.profile.picture = 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
        user.profile.location = (profile._json.location) ? profile._json.location.name : '';
        user.save(function (err) {
          if (err) {
            return (err);
          }
          req.flash('info', { msg: 'Thanks for signing up! You rock!' });
          done(null, user);
        });
      }
    });

  }
}));

/**
 * Sign in with GitHub.
 */

passport.use(new GitHubStrategy({
  clientID: config.github.clientID,
  clientSecret: config.github.clientSecret,
  customHeaders: { 'User-Agent': pkg.name },
  passReqToCallback: true
}, function (req, accessToken, refreshToken, profile, done) {
  if (req.user) { // User alreday logged in!

    // So we must have a [user linking their github account]
    // Let's check to make sure we don't already have an account with same github id
    User.findOne({ github: profile.id }, function (err, existingGithubUser) {
      if (existingGithubUser) {
        req.flash('errors', { msg: 'We already have your GitHub account linked to another account! Sign out, then sign in with that account to delete it. Then sign back in with this account and link your GitHub account.' });
        done(err);
      } else {
        // Link Accounts: Associate the *new* GitHub information to the persons *existing* account
        User.findById(req.user.id, function (err, user) {
          user.github = profile.id;
          user.tokens.push({ kind: 'github', accessToken: accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.picture = user.profile.picture || profile._json.avatar_url;
          user.profile.location = user.profile.location || profile._json.location;
          user.profile.website = user.profile.website || profile._json.blog;
          user.save(function (err) {
            if (err) {
              return done(err, null);
            }
            req.flash('info', { msg: 'Your GitHub account has been linked! :)' });
            done(err, user);
          });
        });
      }
    });
  } else { // Either we have a [brand new user!] or [simply a social login]

    // Do we have an existing user with the same email? If so, just link the account.
    User.findOne({ email: profile._json.email, github: { $exists: false } }, function (err, existingUser) {
      if (err) {
        return (err);
      }
      if (existingUser) {  // Associate the new Facebook information to the persons account
        existingUser.facebook = profile.id;
        existingUser.tokens.push({ kind: 'facebook', accessToken: accessToken });
        existingUser.profile.name = existingUser.profile.name || profile.displayName;
        existingUser.profile.gender = existingUser.profile.gender || profile._json.gender;
        existingUser.profile.picture = existingUser.profile.picture || 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
        existingUser.profile.location = existingUser.profile.location || profile._json.location.name;
        existingUser.save(function (err) {
          if (err) {
            return done(err, null);
          }
          req.flash('info', { msg: 'Your GitHub account has been linked to your existing account!' });
          done(null, existingUser);
        });
      }
    });

    // Do we already have this GitHub user?  Then it's just a login.
    User.findOne({ github: profile.id }, function (err, justLogin) {
      if (justLogin) {
        // update the user's record with login timestamp
        justLogin.activity.last_logon = Date.now();
        justLogin.save(function(err) {
          if (err) {
            return (err);
          }
        });
        return done(null, justLogin);
      } else { // Brand new user!
        var user = new User();
        user.email = profile._json.email;
        user.github = profile.id;
        user.tokens.push({ kind: 'github', accessToken: accessToken });
        user.profile.name = profile.displayName;
        user.profile.picture = profile._json.avatar_url;
        user.profile.location = profile._json.location;
        user.profile.website = profile._json.blog;
        user.save(function (err) {
          if (err) {
            return (err);
          }
          req.flash('info', { msg: 'Thanks for signing up! You rock!' });
          done(null, user);
        });
      }
    });

  }
}));

/**
 * Sign in with Twitter.
 */

passport.use(new TwitterStrategy({
  consumerKey: config.twitter.consumerKey,
  consumerSecret: config.twitter.consumerSecret,
  passReqToCallback: true
}, function (req, accessToken, tokenSecret, profile, done) {
  if (req.user) { // User alreday logged in!

    // So we must have a [user linking their Twitter account]
    // Let's check to make sure we don't already have an account with same Twitter id
    User.findOne({ twitter: profile.id }, function(err, existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'We already have your Twitter account linked to another account! Sign out, then sign in with that account to delete it. Then sign back in with this account and link your Twitter account.' });
        done(err);
      } else {
        // Link Accounts: Associate the *new* Twitter information to the persons *existing* account
        User.findById(req.user.id, function(err, user) {
          user.twitter = profile.id;
          user.tokens.push({ kind: 'twitter', accessToken: accessToken, tokenSecret: tokenSecret });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.location = user.profile.location || profile._json.location;
          user.profile.picture = user.profile.picture || profile._json.profile_image_url;
          user.save(function(err) {
            req.flash('info', { msg: 'Your Twitter account has been linked! :)' });
            done(err, user);
          });
        });
      }
    });
  } else {  // Either we have a [brand new user!] or [simply a social login]

    User.findOne({ twitter: profile.id }, function (err, justLogin) {
      if (justLogin) {
        // update the user's record with login timestamp
        justLogin.activity.last_logon = Date.now();
        justLogin.save(function (err) {
          if (err) {
            return (err);
          }
        });
        return done(null, justLogin);
      } else { // Brand new user!
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
        user.save(function (err) {
          if (err) {
            return (err);
          }
          req.flash('info', { msg: 'Thanks for signing up! You rock!' });
          done(null, user);
        });
      }
    });
  }
}));

/**
 * Sign in with Google.
 */

passport.use(new GoogleStrategy({
  clientID: config.google.clientID,
  clientSecret: config.google.clientSecret,
  scope: ['profile email'],  // get the user's email address
  passReqToCallback: true
}, function (req, accessToken, refreshToken, profile, done) {

  // If we have a user then we are already Logged in!
  // We must be connecting a new social provider to an existing account.
  if (req.user) {

    // Check if we already have someone with that account
    // Why do we care about the email?  Only thing we should be looking for is that google acct
    // User.findOne({ $or: [{ google: profile.id }, { email: profile._json.email }] }, function(err,
    User.findOne({ google: profile.id }, function (err, existingGoogleUser) {
      if (existingGoogleUser) {
        req.flash('errors', { msg: 'We already have your Google account linked to another account! Sign out, then sign in with that account to delete it. Then sign back in with this account and link your Google account.' });
        done(err, null);
      } else {
        // Associate the *new* google information to the persons *existing* account
        User.findById(req.user.id, function (err, user) {
          if (err) {
            return done(err, null);
          }
          user.google = profile.id;
          user.tokens.push({ kind: 'google', accessToken: accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture = user.profile.picture || profile._json.picture;
          user.save(function (err) {
            if (err) {
              return done(err, null);
            }
            req.flash('info', { msg: 'Your Google account has been linked! :)' });
            done(null, user);
          });
        });
      }
    });

  // Either we have a [brand new user!] or [simply a social login]
  } else {

    // Do we have an existing user with the same email?
    // If so, just link the account.
    User.findOne({ email: profile._json.email, google: { $exists: false } }, function (err, existingUser) {
      if (err) {
        return (err);
      }
      if (existingUser) {
        // Associate the new google information to the persons account
        existingUser.google = profile.id;
        existingUser.tokens.push({ kind: 'google', accessToken: accessToken });
        existingUser.profile.name = existingUser.profile.name || profile.displayName;
        existingUser.profile.gender = existingUser.profile.gender || profile._json.gender;
        existingUser.profile.picture = existingUser.profile.picture || profile._json.picture;
        existingUser.save(function (err) {
          if (err) {
            return done(err, null);
          }
          req.flash('info', { msg: 'Your Google account has been linked to your existing account!' });
          done(null, existingUser);
        });

      }
    });

    // Do we already have this google user?  Then it's just a login.
    // If so, just timestamp the login activity
    User.findOne({ google: profile.id }, function (err, justLogin) {
      if (justLogin) {
        // Update the user's record with login timestamp
        justLogin.activity.last_logon = Date.now();
        justLogin.save(function(err) {
          if (err) {
            return (err);
          }
        });
        done(null, justLogin);
      } else { // Else we have a brand new user!
        var user = new User();
        user.email = profile._json.email;
        user.google = profile.id;
        user.tokens.push({ kind: 'google', accessToken: accessToken });
        user.profile.name = profile.displayName;
        user.profile.gender = profile._json.gender;
        user.profile.picture = profile._json.picture;
        user.save(function (err) {
          if (err) {
            return (err);
          }
          req.flash('info', { msg: 'Thanks for signing up! You rock!' });
          done(null, user);
        });
      }

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

exports.isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
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
    next();
  } else {
    res.redirect('/auth/' + provider);
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

