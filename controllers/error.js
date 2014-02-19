'use strict';

/**
 * Error Pages Controller
 */

module.exports.controller = function(app) {

  /**
   * Error Routes
   *
   * NOTE: These routes *only* exist to test
   * error functionality.  They are not
   * used under normal circumstances.
   */

  app.get('/404', function(req, res, next) {
    // trigger a 404:
    // since no other middleware will match /404
    // after this one (and we're not responding here)
    next();
  });

  app.get('/403', function(req, res, next) {
    // trigger a 403 error:
    var err = new Error('Not Allowed!');
    err.status = 403;
    next(err);
  });

  app.get('/500', function(req, res, next) {
    // trigger a generic (500) error:
    next(new Error('Testing 1, 2, 3!'));
  });

};
