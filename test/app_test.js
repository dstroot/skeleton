'use strict';
/*global describe*/
/*global it*/

/**
 * Module Dependencies
 */

var request = require('supertest');
var app = require('../app.js');

/**
 * Test Basic Pages
 */

describe('GET /', function () {
  it('should return 200 OK', function (done) {
    request(app)
      .get('/')
      .expect(200, done);
  });
});

describe('GET /login', function () {
  it('should return 200 OK', function (done) {
    request(app)
      .get('/login')
      .expect(200, done);
  });
});

describe('GET /signup', function () {
  it('should return 200 OK', function (done) {
    request(app)
      .get('/signup')
      .expect(200, done);
  });
});

describe('GET /forgot', function () {
  it('should return 200 OK', function (done) {
    request(app)
      .get('/forgot')
      .expect(200, done);
  });
});

describe('GET /terms', function () {
  it('should return 200 OK', function (done) {
    request(app)
      .get('/terms')
      .expect(200, done);
  });
});

describe('GET /privacy', function () {
  it('should return 200 OK', function (done) {
    request(app)
      .get('/privacy')
      .expect(200, done);
  });
});

/**
 * Test Error Routes
 */

describe('GET /404', function () {
  it('should return 404', function (done) {
    request(app)
      .get('/404')
      .expect(404, done);
  });
});

describe('GET /403', function () {
  it('should return 403', function (done) {
    request(app)
      .get('/403')
      .expect(403, done);
  });
});

describe('GET /500', function () {
  it('should return 500', function (done) {
    request(app)
      .get('/500')
      .expect(500, done);
  });
});
