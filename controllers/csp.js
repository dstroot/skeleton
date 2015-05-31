'use strict';

/**
 * CSP Controller
 */

module.exports.controller = function (app) {

  /**
   * CSP Logging Route
   *
   * NOTE: CSP errors are posted to this route
   *
   */

  app.post('/report-violation', function (req, res) {
    // Just log it to see if this is working
    console.log('CSP: ' + req.body);
  });

};
