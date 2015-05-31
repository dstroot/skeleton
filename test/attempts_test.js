'use strict';
/*global describe*/
/*global before*/
/*global it*/

/**
 * Module Dependencies
 */

var should  = require('chai').should();
var Attempt    = require('../models/LoginAttempt');
var attempt;

/**
 * Test User Model
 */

describe('Login Attempt Attributes', function () {

  before(function (done) {
    attempt = new Attempt({
      ip: '192.168.15.155',
      user: 'Test User'
    });
    done();
  });

  it('ip should be a string', function () {
    attempt.ip.should.be.a('string');
  });

  it('user should be a string', function () {
    attempt.user.should.be.a('string');
  });

  it('should save an attempt', function (done) {
    attempt.save(function (err) {
      if (err) {
        throw (err);
      }
      done();
    });
  });

  it('should find our attempt by user', function (done) {
    Attempt.findOne({ user: attempt.user }, function (err, attempt) {
      should.exist(attempt);
      attempt.user.should.equal('Test User');
      done();
    });
  });

  it('should find our attempt by ip', function (done) {
    Attempt.findOne({ ip: attempt.ip }, function (err, attempt) {
      should.exist(attempt);
      attempt.ip.should.equal('192.168.15.155');
      done();
    });
  });

  it('should allow attempts to be deleted', function (done) {
    attempt.remove(function (err, attempt) {
      if (err) {
        throw (err);
      }
      done();
    });
  });

});
