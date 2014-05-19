'use strict';

/**
 * Home Controller
 */

module.exports.controller = function (app) {

  app.get('/', function( req, res) {
    if (req.user) {
      return res.redirect('/api');
    }
    res.render('home/home', {
      url: req.url
    });
  });

};
