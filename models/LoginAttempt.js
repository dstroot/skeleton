'use strict';

/**
 * Module Dependencies
 */

var mongoose  = require('mongoose');
var config    = require('../config/config');

/**
 * Define Login Attempts Schema
 */

var attemptSchema = new mongoose.Schema({
  ip: { type: String, default: '' },
  user: { type: String, default: '' },
  time: { type: Date, default: Date.now, expires: config.loginAttempts.expires }
});

/**
 * Define Indices
 */

attemptSchema.index({ ip: 1 });
attemptSchema.index({ user: 1 });
attemptSchema.set('autoIndex');

/**
 * Export Model
 */

module.exports = mongoose.model('LoginAttempt', attemptSchema);
