'use strict';

/**
 * Module Dependencies
 */

var debug         = require('debug')('skeleton');       // https://github.com/visionmedia/debug
var config        = require('../config/config');
var nodemailer    = require('nodemailer');

/**
 * Contact Form Controller
 */

module.exports.controller = function (app) {

  /**
   * GET /contact
   * Contact form page.
   */

  app.get('/contact', function (req, res) {
    res.render('contact/contact', {
      url: req.url
    });
  });

  /**
   * POST /contact
   * Send a contact form via Nodemailer.
   * @param {string} email
   * @param {string} name
   * @param {string} message
   */

  app.post('/contact', function (req, res) {

    req.assert('name', 'Name cannot be blank').notEmpty();
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('message', 'Message cannot be blank').notEmpty();

    var errors = req.validationErrors();

    if (errors) {
      req.flash('error', errors);
      return res.redirect('/contact');
    }

    // Create reusable transporter object using SMTP transport
    var transporter = nodemailer.createTransport({
      service: 'Gmail',
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
    transporter.sendMail(mailOptions, function (err, info) {
      if (err) {
        req.flash('error', { msg: JSON.stringify(err) });
        debug(JSON.stringify(err));
        res.redirect('back');
      } else {
        req.flash('success', { msg: 'Your message has been sent successfully!' });
        debug('Message response: ' + info.response);
        res.redirect('/contact');
      }
    });

  });

};
