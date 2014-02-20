'use strict';

/**
 * Why like this?
 *  - all environmental vars documented in one place
 *  - If I use "." notation it's easy to cut/paste into code
 *  - Unlike JSON, js allows comments (what is this setting for?)
 */

/**
 * Configuration File
 */

module.exports = {

  /**
   * The Basics
   */

  port: process.env.PORT || 3000,
  cryptoKey: process.env.CRYPTOKEY || '',

  /**
   * Logging Configuration
   */

  logging: true,
  logfilename: 'skeleton.log',

  /**
   * Database Configuration
   */

  mongodb: {
    mongodbUrl: process.env.MONGODB_URL || ''
  },

  /**
   * Session Configuration
   */

  session: {
    sessionKey: process.env.SESSION_KEY || '',
    sessionSecret: process.env.SESSION_SECRET || ''
  },

  /**
   * Mailing Configuration
   */

  // Who are we sending email as?
  smtp: {
    name: process.env.SMTP_FROM_NAME || '',
    address: process.env.SMTP_FROM_ADDRESS || ''
  },

  // How are we sending it?
  gmail: {
    gmail.user: process.env.SMTP_USERNAME || '',
    gmail.password: process.env.SMTP_PASSWORD || ''
  },

  /**
   * API Keys
   */

  // New York Times
  nyt                        = {};
  nyt.key                    = process.env.NYT_KEY || '';

  // Last FM
  lastfm                     = {};
  lastfm.api_key             = process.env.LASTFM_KEY || '';
  lastfm.secret              = process.env.LASTFM_SECRET || '';

  // Steam
  steam                      = {};
  steam.id                   = process.env.STEAM_ID || '';
  steam.key                  = process.env.STEAM_KEY || '';

  // Twilio
  twilio                     = {};
  twilio.sid                 = process.env.TWILIO_SID || '';
  twilio.token               = process.env.TWILIO_TOKEN || '';
  twilio.phone               = process.env.TWILIO_PHONE || '';

  // Tumblr
  tumblr                     = {};
  tumblr.key                 = process.env.TUMBLR_KEY || '';
  tumblr.secret              = process.env.TUMBLR_SECRET || '';
  tumblr.callbackURL         = '/auth/tumblr/callback';

  // Foursquare
  foursquare                 = {};
  foursquare.clientId        = process.env.FOURSQUARE_KEY || '';
  foursquare.clientSecret    = process.env.FOURSQUARE_SECRET || '';
  foursquare.redirectUrl     = 'http://localhost:3000/auth/foursquare/callback';

  // Paypal
  paypal                     = {};
  paypal.host                = 'api.sandbox.paypal.com';
  paypal.client_id           = process.env.PAYPAL_KEY || '';
  paypal.client_secret       = process.env.PAYPAL_SECRET || '';
  paypal.returnUrl           = 'http://localhost:3000/api/paypal/success';
  paypal.cancelUrl           = 'http://localhost:3000/api/paypal/cancel';

  /**
   * Authorization Configuration
   */

  localAuth = true;

  // Facebook
  facebookAuth = true;
  facebook                   = {};
  facebook.clientID          = process.env.FACEBOOK_KEY || '';
  facebook.clientSecret      = process.env.FACEBOOK_SECRET || '';
  facebook.callbackURL       = '/auth/facebook/callback';
  facebook.passReqToCallback = true;

  // Github
  githubAuth = true;
  github                     = {};
  github.clientID            = process.env.GITHUB_KEY || '';
  github.clientSecret        = process.env.GITHUB_SECRET || '';
  github.callbackURL         = '/auth/github/callback';
  github.passReqToCallback   = true;

  // Twitter
  twitterAuth = true;
  twitter                    = {};
  twitter.consumerKey        = process.env.TWITTER_KEY || '';
  twitter.consumerSecret     = process.env.TWITTER_SECRET || '';
  twitter.callbackURL        = '/auth/twitter/callback';
  twitter.passReqToCallback  = true;

  // Google
  googleAuth = true;
  google                     = {};
  google.clientID            = process.env.GOOGLE_KEY || '';
  google.clientSecret        = process.env.GOOGLE_SECRET || '';
  google.callbackURL         = '/auth/google/callback';
  google.passReqToCallback   = true;




































  db: 'localhost',

  localAuth: true,
  sessionSecret: "Your Session Secret goes here",

  mailgun: {
    login: 'Your Mailgun SMTP Username',
    password: 'Your Mailgun SMTP Password'
  },

  sendgrid: {
    user: 'Your SendGrid Username',
    password: 'Your SendGrid Password'
  },

  gmail: {
    user: 'Your Gmail Username',
    password: 'Your Gmail Password'
  },

  nyt: {
    key: 'Your New York Times API Key'
  },

  lastfm: {
    api_key: 'Your API Key',
    secret: 'Your API Secret'
  },

  facebookAuth: true,
  facebook: {
    clientID: 'Your App ID',
    clientSecret: 'Your App Secret',
    callbackURL: '/auth/facebook/callback',
    passReqToCallback: true
  },

  githubAuth: true,
  github: {
    clientID: 'Your Client ID',
    clientSecret: 'Your Client Secret',
    callbackURL: '/auth/github/callback',
    passReqToCallback: true
  },

  twitterAuth: true,
  twitter: {
    consumerKey: 'Your Consumer Key',
    consumerSecret: 'Your Consumer Secret',
    callbackURL: '/auth/twitter/callback',
    passReqToCallback: true
  },

  googleAuth: true,
  google: {
    clientID: 'Your Client ID',
    clientSecret: 'Your Client Secret',
    callbackURL: '/auth/google/callback',
    passReqToCallback: true
  },

  steam: {
    apiKey: 'Your Steam API Key'
  },

  twilio: {
    sid: 'Your Account SID',
    token: 'Your Auth Token'
  },

  tumblr: {
    consumerKey: 'Your Consumer Key',
    consumerSecret: 'Your Consumer Secret',
    callbackURL: '/auth/tumblr/callback'
  },

  foursquare: {
    clientId: 'Your Client ID',
    clientSecret: 'Your Client Secret',
    redirectUrl: 'http://localhost:3000/auth/foursquare/callback'
  },

  venmo: {
    clientId: 'Your Venmo Client ID',
    clientSecret: 'Your Venmo Client Secret',
    redirectUrl: 'http://localhost:3000/auth/venmo/callback'
  },

  paypal: {
    host: 'api.sandbox.paypal.com', // or api.paypal.com
    client_id: 'Your Client ID',
    client_secret: 'Your Client Secret',
    returnUrl: 'http://localhost:3000/api/paypal/success',
    cancelUrl: 'http://localhost:3000/api/paypal/cancel'
  }
};
