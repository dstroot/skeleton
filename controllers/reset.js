'use strict';

/**
 * Module Dependencies
 */

var User          = require('../models/User');
var config        = require('../config/config');
var bcrypt        = require('bcrypt-nodejs');
var nodemailer    = require('nodemailer');

/**
 * Reset Page Controller
 */

module.exports.controller = function (app) {

  /**
   * GET /reset/:id/:token
   * Reset your password page
   */

  app.get('/reset/:id/:token', function (req, res) {
    if (req.user) {
      return res.redirect('/');  //user already logged in!
    }

    // Get the user using their ID
    User.findOne({ _id: req.params.id })
      .where('resetPasswordExpires').gt(Date.now())
      .exec(function (err, user) {
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
        bcrypt.compare(req.params.token, user.resetPasswordToken, function (err, isValid) {
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
              url: req.url
            });
          }
        });
      });
  });

  /**
   * POST /reset/:id/:token
   * Process the POST to reset your password
   */

  app.post('/reset/:id/:token', function (req, res) {

    // Create a workflow (here you could also use the async waterfall pattern)
    var workflow = new (require('events').EventEmitter)();

    /**
     * Step 1: Validate the password(s) meet complexity requirements and match.
     */

    workflow.on('validate', function () {

      req.assert('password', 'Your password cannot be blank.').notEmpty();
      req.assert('confirm', 'Your password confirmation cannot be blank.').notEmpty();
      req.assert('password', 'Your password must be at least 4 characters long.').len(4);
      req.assert('confirm', 'Your passwords must match.').equals(req.body.password);

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

    workflow.on('findUser', function () {

      // Get the user using their ID
      User.findOne({ _id: req.params.id })
        .where('resetPasswordExpires').gt(Date.now())
        .exec(function(err, user) {
          if (err) {
            req.flash('errors', { msg: err.message });
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
              req.flash('errors', { msg: err.message });
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

    workflow.on('updatePassword', function (user) {

      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      // update the user record
      user.save(function (err) {
        if (err) {
          req.flash('errors', { msg: err.message });
          return res.redirect('back');
        }
        // Log the user in
        req.logIn(user, function (err) {
          if (err) {
            req.flash('errors', { msg: err.message });
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

    workflow.on('sendEmail', function (user) {

      // Create a reusable nodemailer transport method (opens a pool of SMTP connections)
      var smtpTransport = nodemailer.createTransport('SMTP',{
        service: 'Gmail',
        auth: {
          user: config.gmail.user,
          pass: config.gmail.password
        }
      });

      // Render HTML to send using .jade mail template (just like rendering a page)
      res.render('mail/passwordChange', {
        name:          user.profile.name,
        mailtoName:    config.smtp.name,
        mailtoAddress: config.smtp.address
      }, function(err, html) {
        if (err) {
          return (err, null);
        }
        else {

          // Now create email text (multiline string as array FTW)
          var text = [
            'Hello ' + user.profile.name + '!',
            'This is a courtesy message to confirm that your password was just changed.',
            'Thanks so much for using our services! If you have any questions, or suggestions, feel free to email us here at ' + config.smtp.address + '.',
            '  - The ' + config.smtp.name + ' team'
          ].join('\n\n');

          // Create email
          var mailOptions = {
            to:       user.profile.name + ' <' + user.email + '>',
            from:     config.smtp.name + ' <' + config.smtp.address + '>',
            subject:  'Your ' + app.locals.application + ' password was reset',
            text:     text,
            html:     html
          };

          // Send email
          smtpTransport.sendMail(mailOptions, function (err) {
            if (err) {
              req.flash('errors', { msg: err.message });
            }
            // shut down the connection pool, no more messages
            smtpTransport.close();
          });

          // Send user on their merry way
          req.flash('success', { msg: 'Your password has been changed!' });
          res.redirect('/api');

        }
      });

    });

  /**
   * Initiate the workflow
   */

    workflow.emit('validate');

  });
};
