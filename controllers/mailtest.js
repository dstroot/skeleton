'use strict';

/**
 * Mail Test Controller
 *
 * *Only* used to test email format rendering:
 * Change jade email templates and render in your browser
 * to see what it will look like.
 *
 */

module.exports.controller = function (app) {

  app.get('/mail', function (req, res) {

    //user must be logged in
    if (!req.user) {
      return res.redirect('/');
    }

    //user must be be an administrator
    if (req.user.type !== 'admin') {
      req.flash('warning', { msg: 'You must be an administrator to test email layouts.' });
      return res.redirect('/api');
    }

    res.render('mail/welcome', { // <- What template do you want to test?
      // set proper options
      name:          'Dan',
      resetLink:     req.protocol + '://' + req.headers.host + '/reset/',
      mailtoName:    'Skeleton',
      mailtoAddress: 'config.smtp.address'
    });
  });

};
