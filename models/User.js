'use strict';

/**
 * Module Dependencies
 */

var bcrypt    = require('bcrypt-nodejs');
var crypto    = require('crypto');
var mongoose  = require('mongoose');

/**
 * Define User Schema
 */

// The permitted SchemaTypes are:

// String
// Number
// Date
// Buffer
// Boolean
// Mixed
// ObjectId
// Array

// When your application starts up, Mongoose automatically calls
// ensureIndex for each defined index in your schema. While nice
// for development, it is recommended this behavior be disabled
// in production since index creation can cause a significant
// performance impact. Disable the behavior by setting the
// autoIndex option of your schema to false.

var userSchema = new mongoose.Schema({

  email: { type: String, unique: true, index: true },
  password: { type: String },
  type: { type: String, default: 'admin' },
  // EVERYONE'S AN ADMINISTRATOR IN EXAMPLE
  // DEFAULT TYPE SHOULB BE 'user'!
  // type: { type: String, default: 'user' },

  facebook: { type: String, unique: true, sparse: true },
  twitter: { type: String, unique: true, sparse: true },
  google: { type: String, unique: true, sparse: true },
  github: { type: String, unique: true, sparse: true },
  tokens: Array,

  profile: {
    name: { type: String, default: '' },
    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    picture: { type: String, default: '' },
    phone: {
      work: { type: String, default: '' },
      home: { type: String, default: '' },
      mobile: { type: String, default: '' }
    }
  },

  activity: {
    date_established: { type: Date, default: Date.now },
    last_logon: { type: Date, default: Date.now },
    last_updated: { type: Date }
  },

  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  verified: { type: Boolean, default: true },
  verifyToken: { type: String },

  enhancedSecurity: {
    enabled: { type: Boolean, default: false },
    type: { type: String },  // sms or totp
    token: { type: String },
    period: { type: Number },
    sms: { type: String },
    smsExpires: { type: Date }
  }

});

/**
 * Hash the password and sms token for security.
 */

userSchema.pre('save', function (next) {

  var user = this;
  var SALT_FACTOR = 5;

  if (!user.isModified('password')) {
    return next();
  } else {
    bcrypt.genSalt(SALT_FACTOR, function (err, salt) {
      if (err) {
        return next(err);
      }
      bcrypt.hash(user.password, salt, null, function (err, hash) {
        if (err) {
          return next(err);
        }
        user.password = hash;
        next();
      });
    });
  }

  // if (!user.isModified('enhancedSecurity.sms')) {
  //   return next();
  // } else {
  //   bcrypt.genSalt(SALT_FACTOR, function(err, salt) {
  //     if (err) {
  //       return next(err);
  //     }
  //     bcrypt.hash(user.enhancedSecurity.sms, salt, null, function (err, hash) {
  //       if (err) {
  //         return next(err);
  //       }
  //       user.enhancedSecurity.sms = hash;
  //       next();
  //     });
  //   });
  // }

});

/**
 * Check the user's password
 */

userSchema.methods.comparePassword = function (candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) {
      return cb(err);
    }
    cb(null, isMatch);
  });
};

/**
 * Check user's SMS token
 */

userSchema.methods.compareSMS = function (candidateSMS, cb) {
  bcrypt.compare(candidateSMS, this.enhancedSecurity.sms, function (err, isMatch) {
    if (err) {
      return cb(err);
    }
    cb(null, isMatch);
  });
};

/**
 *  Get a URL to a user's Gravatar email.
 */

userSchema.methods.gravatar = function (size, defaults) {
  if (!size) {
    size = 200;
  }
  if (!defaults) {
    defaults = 'retro';
  }
  if (!this.email) {
    return 'https://gravatar.com/avatar/?s=' + size + '&d=' + defaults;
  }
  var md5 = crypto.createHash('md5').update(this.email);
  return 'https://gravatar.com/avatar/' + md5.digest('hex').toString() + '?s=' + size + '&d=' + defaults;
};

module.exports = mongoose.model('User', userSchema);
