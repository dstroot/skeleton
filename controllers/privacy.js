'use strict';

/**
 * Privacy Controller
 */

module.exports.controller = function(app) {

  app.get('/privacy', function(req, res) {
    res.render('privacy/privacy', {
      url: req.url,
      title: app.locals.title
    });
  });

}
