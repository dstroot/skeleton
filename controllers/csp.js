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

  // Trigger a 404:
  app.post('/report-violation', function (req, res) {
    // Since no other middleware will match route /404
    // after this one (and we're not responding here!)
    console.log('CSP: ' + req.body);
  });

};
