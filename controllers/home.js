'use strict';

/**
 * Home Controller
 */

module.exports.controller = function(app) {

  app.get('/', function(req, res) {
    res.render('home/home', {
      url: req.url,
      title: app.locals.title
    });
  });

}
