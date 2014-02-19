'use strict';

/**
 * Module Dependencies
 */

var bcrypt        = require('bcrypt-nodejs');
var nodemailer    = require('nodemailer');
var User          = require('../models/User');
var config        = require('../config/config');

/**
 * Reset Page Controller
 */

module.exports.controller = function(app) {

  /**
   * GET /reset/:id/:token
   * Reset your password page
   */

  app.get('/reset/:id/:token', function(req, res) {
    if (req.user) {
      return res.redirect('/');  //user already logged in!
    }

    // Get the user using their ID
    User.findOne({ _id: req.params.id })
        .where('resetPasswordExpires').gt(Date.now())
        .exec(function(err, user) {
      if (err) {
        req.flash('errors', err);
        req.flash('warning', { msg: 'Your password reset request is invalid or has expired. Try again?' });
        return res.redirect('/forgot');
      }
      if (!user) {
        req.flash('warning', { msg: 'Your password reset request is invalid or has expired. Try again?' });
        return res.redirect('/forgot');
      }
      // Validate their token
      bcrypt.compare(req.params.token, user.resetPasswordToken, function(err, isValid) {
        if (err) {
          req.flash('errors', err);
          req.flash('warning', { msg: 'Your password reset request is invalid or has expired. Try again?' });
          return res.redirect('/forgot');
        }
        if (!isValid) {
          req.flash('warning', { msg: 'Your password reset request is invalid or has expired. Try again?' });
          return res.redirect('/forgot');
        } else {
          res.render('account/reset', {
            url: req.url,
            title: app.locals.title,
          });
        }
      });
    });
  });

  /**
   * POST /reset/:id/:token
   * Process the POST to reset your password
   */

  app.post('/reset/:id/:token', function(req, res) {

    // Create a workflow (here you could also use the async waterfall pattern)
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the password(s) meet complexity requirements and match.
     */

    workflow.on('validate', function() {

      req.assert('password', 'Password must be at least 4 characters long.').len(4);
      req.assert('confirm', 'Passwords must match.').equals(req.body.password);

      var errors = req.validationErrors();

      if (errors) {
        req.flash('errors', errors);
        return res.redirect('back');
      }

      // next step
      workflow.emit('findUser');
    });

    /**
     * Step 2: Lookup the User
     * We are doing this again in case the user changed the URL
     */

    workflow.on('findUser', function() {

      // Get the user using their ID
      User.findOne({ _id: req.params.id })
          .where('resetPasswordExpires').gt(Date.now())
          .exec(function(err, user) {
        if (err) {
          req.flash('errors', err);
          req.flash('warning', { msg: 'Your password reset request is invalid or has expired. Try again?' });
          return res.redirect('/forgot');
        }
        if (!user) {
          req.flash('warning', { msg: 'Your password reset request is invalid or has expired. Try again?' });
          return res.redirect('/forgot');
        }
        // Validate their token
        bcrypt.compare(req.params.token, user.resetPasswordToken, function(err, isValid) {
          if (err) {
            req.flash('errors', err);
            req.flash('warning', { msg: 'Your password reset request is invalid or has expired. Try again?' });
            return res.redirect('/forgot');
          }
          if (!isValid) {
            req.flash('warning', { msg: 'Your password reset request is invalid or has expired. Try again?' });
            return res.redirect('/forgot');
          }
        });

        // next step
        workflow.emit('updatePassword', user);
      });
    });

    /**
     * Step 3: Update the User's Password and clear the
     * clear the reset token
     */

    workflow.on('updatePassword', function(user) {

      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      // update the user record
      user.save(function(err) {
        if (err) {
          req.flash('errors', err);
          return res.redirect('back');
        }
        // Log the user in
        req.logIn(user, function(err) {
          if (err) {
            req.flash('errors', err);
            return res.redirect('back');
          }

          // next step
          workflow.emit('sendEmail', user);
        });
      });
    });

    /**
     * Step 4: Send the User an email letting them know thier
     * password was changed.  This is important in case the
     * user did not initiate the reset!
     */

    workflow.on('sendEmail', function(user) {

      // Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      var smtpTransport = nodemailer.createTransport("SMTP",{
        service: "Gmail",
        auth: {
          user: config.gmail.user,
          pass: config.gmail.password
        }
        // See nodemailer docs for other transports
        // https://github.com/andris9/Nodemailer
      });

      // Create email
      var mailOptions = {
        to:       user.profile.name + ' <' + user.email + '>',
        from:     config.smtp.name + ' <' + config.smtp.address + '>',
        subject:  'Password Reset Notice From ' + app.locals.title,
        text:     'Hello, this is a courtesy message from ' + app.locals.title + '.\n\nYour password was just reset.  Cheers!'
      };

      // Send email
      smtpTransport.sendMail(mailOptions, function(err) {
        if (err) {
          req.flash('errors', { msg: err.message });
        }
      });

      // shut down the connection pool, no more messages
      smtpTransport.close();

      // Send user on their merry way
      req.flash('success', { msg: 'Your password has been changed!' });
      res.redirect('/api');

    });

  /**
   * Initiate the workflow
   */

    workflow.emit('validate');

  });
};
