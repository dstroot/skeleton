'use strict';

/**
 * Module dependencies.
 */

var nodemailer    = require("nodemailer");
var config        = require('../config/config');

/**
 * Contact Form Controller
 */

module.exports.controller = function(app) {

  /**
   * GET /contact
   * Contact form page.
   */

  app.get('/contact', function(req, res) {
    res.render('contact/contact', {
      url: req.url,
      title: app.locals.title
    });
  });

  /**
   * POST /contact
   * Send a contact form via Nodemailer.
   * @param {string} email
   * @param {string} name
   * @param {string} message
   */

  app.post('/contact', function(req, res) {

    req.assert('name', 'Name cannot be blank').notEmpty();
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('message', 'Message cannot be blank').notEmpty();

    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/contact');
    }

    // Create a reusable nodemailer transport method (opens a pool of SMTP connections)
    var smtpTransport = nodemailer.createTransport("SMTP",{
      service: "Gmail",
      auth: {
        user: config.gmail.user,
        pass: config.gmail.password
      }
    });

    // Create email
    var mailOptions = {
      to:       config.smtp.name + ' <' + config.smtp.address + '>',
      from:     req.body.name + ' <' + req.body.email + '>',
      subject:  'Contact Form',
      text:     req.body.message + '\n\n' + req.body.name
    };

    // Send email
    smtpTransport.sendMail(mailOptions, function(err) {
      if (err) {
        req.flash('errors', { msg: err.message });
        return res.redirect('/contact');
      }
      req.flash('success', { msg: 'Email has been sent successfully!' });
      res.redirect('/contact');
    });

    // Shut down the connection pool, no more messages
    smtpTransport.close();

  });

};
