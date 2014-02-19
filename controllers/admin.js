'use strict';

var User          = require('../models/User');

/**
 * Admin Pages Controller
 */

module.exports.controller = function(app) {

  /**
   * GET /dashboard
   * Render Dashboard Page
   */

  app.get('/dashboard', function(req, res) {

    //user must be logged in
    if (!req.user) {
      return res.redirect('/');
    }

    //user must be be an administrator
    if (req.user.type !== 'admin') {
      return res.redirect('/api');
    }

    User.count({}, function(err, count) {
      if (err) {
        return (err, null);
      }
      res.render('admin/dashboard', {
        url: '/administration',  // to set navbar active state
        title: app.locals.title,
        accounts: count
      });
    });

  });

  /**
   * GET /accounts
   * Render accounts page
   */

  app.get('/accounts', function(req, res) {

    //user must be logged in
    if (!req.user) {
      return res.redirect('/');
    }

    //user must be be an administrator
    if (req.user.type !== 'admin') {
      return res.redirect('/api');
    }

    res.render('admin/accounts', {
      url: '/administration', // to set navbar active state
      title: app.locals.title,
      token: res.locals.token
    });
  });

  /**
   * GET /accountlist
   * JSON accounts api
   */

  app.get('/accountlist', function(req, res) {

    //user must be logged in
    if (!req.user) {
      return res.redirect('/');
    }

    //user must be be an administrator
    if (req.user.type !== 'admin') {
      return res.redirect('/api');
    }

    User.find({}, function (err, items) {
      if (err) {
        return (err, null);
      }
      res.json(items);
    });
  });

  /**
   * DEL /accountlist/:id
   * JSON accounts delete api
   */

  app.del('/accountlist/:id', function(req, res) {

    //user must be logged in
    if (!req.user) {
      return res.redirect('/');
    }

    //user must be be an administrator
    if (req.user.type !== 'admin') {
      return res.redirect('/api');
    }

    User.remove({ _id : req.params.id }, function(err, result) {
      res.send((result === 1) ? { msg: '' } : { msg:'error: ' + err });
    });

  });

};
