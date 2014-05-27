'use strict';

/**
 * Error Pages Controller
 */

module.exports.controller = function (app) {

  /**
   * Error Routes
   *
   * NOTE: These routes *only* exist to test error functionality.
   * They are not used under normal circumstances.
   */

  // Trigger a 404:
  app.get('/404', function (req, res, next) {
    // Since no other middleware will match route /404
    // after this one (and we're not responding here!)
    next();
  });

  // Trigger a 403 error:
  app.get('/403', function (req, res, next) {
    var err = new Error('That is not allowed!');
    err.status = 403;
    next(err);
  });

  // Trigger a generic (500) error:
  app.get('/500', function (req, res, next) {
    var err = new Error('Testing 1, 2, 3!');
    err.status = 500;
    next(err);
  });

};
