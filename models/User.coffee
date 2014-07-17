'use strict'

###
Module Dependencies
###
bcrypt = require('bcrypt-nodejs')
crypto = require('crypto')
mongoose = require('mongoose')

###
Define User Schema
###

# The permitted SchemaTypes are:

# String
# Number
# Date
# Buffer
# Boolean
# Mixed
# ObjectId
# Array

# When your application starts up, Mongoose automatically calls
# ensureIndex for each defined index in your schema. While nice
# for development, it is recommended this behavior be disabled
# in production since index creation can cause a significant
# performance impact. Disable the behavior by setting the
# autoIndex option of your schema to false.
userSchema = new mongoose.Schema(
  email:
    type: String, unique: true, index: true
  password:
    type: String
  type:
    type: String, default: 'admin'

  # EVERYONE'S AN ADMINISTRATOR IN EXAMPLE
  # DEFAULT TYPE SHOULB BE 'user'!
  # type: type: String, default: 'user'

  facebook:
    type: String, unique: true, sparse: true
  twitter:
    type: String, unique: true, sparse: true
  google:
    type: String, unique: true, sparse: true
  github:
    type: String, unique: true, sparse: true
  tokens: Array
  profile:
    name:
      type: String, default: ''
    gender:
      type: String, default: ''
    location:
      type: String, default: ''
    website:
      type: String, default: ''
    picture:
      type: String, default: ''
    phone:
      work:
        type: String, default: ''
      home:
        type: String, default: ''
      mobile:
        type: String, default: ''
  activity:
    date_established:
      type: Date, default: Date.now
    last_logon:
      type: Date, default: Date.now
    last_updated:
      type: Date
  resetPasswordToken:
    type: String
  resetPasswordExpires:
    type: Date
  verified:
    type: Boolean, default: true
  verifyToken:
    type: String
  enhancedSecurity:
    enabled:
      type: Boolean, default: false
    type: # sms or totp
      type: String
    token:
      type: String
    period:
      type: Number
    sms:
      type: String
    smsExpires:
      type: Date
)

###
Hash the password and sms token for security.
###
userSchema.pre 'save', (next) ->
  user = this
  SALT_FACTOR = 5
  unless user.isModified('password')
    return next()
  else
    bcrypt.genSalt SALT_FACTOR, (err, salt) ->
      return next(err) if err
      bcrypt.hash user.password, salt, null, (err, hash) ->
        return next(err) if err
        user.password = hash
        return next()

###
Check the user's password
###
userSchema.methods.comparePassword = (candidatePassword, cb) ->
  bcrypt.compare candidatePassword, @password, (err, isMatch) ->
    return cb(err) if err
    cb null, isMatch

###
Check user's SMS token
###
userSchema.methods.compareSMS = (candidateSMS, cb) ->
  bcrypt.compare candidateSMS, @enhancedSecurity.sms, (err, isMatch) ->
    return cb(err) if err
    cb null, isMatch

###
Get a URL to a user's Gravatar email.
###
userSchema.methods.gravatar = (size, defaults) ->
  size = 200 unless size
  defaults = 'retro' unless defaults
  return 'https://gravatar.com/avatar/?s=' + size + '&d=' + defaults unless @email
  md5 = crypto.createHash('md5').update(@email)
  return 'https://gravatar.com/avatar/' + md5.digest('hex').toString() + '?s=' + size + '&d=' + defaults

module.exports = mongoose.model('User', userSchema)