'use strict';

/**
 * Terms Controller
 */

module.exports.controller = function(app) {

  app.get('/terms', function(req, res) {
    res.render('terms/terms', {
      url: req.url
    });
  });

};
