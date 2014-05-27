'use strict';

/**
 * Robots Controller
 */

module.exports.controller = function (app) {

  /**
   * Robots Routes
   *
   * www.robotstxt.org/
   * www.google.com/support/webmasters/bin/answer.py?hl=en&answer=156449
   */

  if (app.get('env') === 'development') {
    // In development keep search engines out
    app.all('/robots.txt', function (req, res) {
      res.charset = 'text/plain';
      res.send('User-agent: *\nDisallow: /');
    });
  }

  if (app.get('env') === 'production') {
    // Allow all search engines
    app.all('/robots.txt', function (req, res) {
      res.charset = 'text/plain';
      res.send('User-agent: *');
    });
  }

};
