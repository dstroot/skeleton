'use strict';

/**
 * Module Dependencies
 */

// Needed for Express 4.x
var csrf              = require('csurf');                   // https://github.com/expressjs/csurf
var logger            = require('morgan');                  // https://github.com/expressjs/morgan
var express           = require('express');                 // https://npmjs.org/package/express
var favicon           = require('serve-favicon');           // https://github.com/expressjs/favicon
var session           = require('express-session');         // https://github.com/expressjs/session
var compress          = require('compression');             // https://github.com/expressjs/compression
var bodyParser        = require('body-parser');             // https://github.com/expressjs/body-parser
var serveStatic       = require('serve-static');            // https://github.com/expressjs/serve-static
var cookieParser      = require('cookie-parser');           // https://github.com/expressjs/cookie-parser
var errorHandler      = require('errorhandler');            // https://github.com/expressjs/errorhandler
var methodOverride    = require('method-override');         // https://github.com/expressjs/method-override

// Additional Modules
var fs                = require('fs');                      // http://nodejs.org/docs/v0.10.25/api/fs.html
var path              = require('path');                    // http://nodejs.org/docs/v0.10.25/api/path.html
var debug             = require('debug')('skeleton');       // https://github.com/visionmedia/debug
var flash             = require('express-flash');           // https://npmjs.org/package/express-flash
var config            = require('./config/config');         // Get configuration file
var helmet            = require('helmet');                  // https://github.com/evilpacket/helmet
var semver            = require('semver');                  // https://npmjs.org/package/semver
var enforce           = require('express-sslify');          // https://github.com/florianheinemann/express-sslify
var winston           = require('winston');                 // https://npmjs.org/package/winston
var mongoose          = require('mongoose');                // https://npmjs.org/package/mongoose
var passport          = require('passport');                // https://npmjs.org/package/passport
var MongoStore        = require('connect-mongo')(session);  // https://npmjs.org/package/connect-mongo
var expressValidator  = require('express-validator');       // https://npmjs.org/package/express-validator

/**
 * Create Express App
 */

var app         = module.exports = express();  // export app for testing

/**
 * Create Express HTTP Server and socket.io listener
 */

var server      = require('http').createServer(app);
var io          = require('socket.io')(server, {
  // 'browser client minification': true,  // Send minified client
  // 'browser client etag': true,          // Apply etag caching logic based on version number
  // 'browser client gzip': true,          // Gzip the file
  // 'browser client expires': true,       // Adds Cache-Control: private, x-gzip-ok="", max-age=31536000 header
  // // Should be set to true when you want the location handshake
  // // to match the protocol of the origin. This fixes issues with
  // // terminating the SSL in front of Node and forcing location
  // // to think it's wss instead of ws.
  // 'match origin protocol': true         // Used when running socket.io behind a proxy.
});

/**
 * Configure Logging
 */

// TODO: Logging in production should be directed to a logging service
// such as loggly.com or to a log server or database.
if ( config.logging ) {
  winston.add(winston.transports.File, { filename: config.logfilename });
}

// Turn off Winston console logging, we will use Express instead
winston.remove(winston.transports.Console);

/**
 * Configure Mongo Database
 */

mongoose.connect(config.mongodb.url);
var db = mongoose.connection;

// Use Mongo for session store
config.session.store  = new MongoStore({
  mongoose_connection: db,
  auto_reconnect: true
});

/**
 * Express Configuration and Setup
 */

// Application local variables are provided to *all* templates
// rendered within the application. personally I would have called
// them "app.globals". They are useful for providing helper
// functions to templates, as well as global app-level data.

// NOTE: you must *not* reuse existing (native) named properties
// for your own variable names, such as name, apply, bind, call,
// arguments, length, and constructor.

app.locals.application  = config.name;
app.locals.version      = config.version;
app.locals.description  = config.description;
app.locals.author       = config.author;
app.locals.keywords     = config.keywords;
app.locals.ga           = config.ga;

// Use moment anywhere within a jade template like this:
// p #{moment(Date.now()).format('MM/DD/YYYY')}
// Good for an evergreen copyright ;)
app.locals.moment       = require('moment');

if (app.get('env') === 'development') {
  // Jade options: Don't minify html, debug intrumentation
  app.locals.pretty = true;
  app.locals.compileDebug = true;
  // Turn on console logging in development
  app.use(logger('dev'));
  // Turn off HTTPS/SSL cookies in development
  config.session.proxy = false;
  config.session.cookie.secure = false;
}

if (app.get('env') === 'production') {
  // Jade options: minify html, no debug intrumentation
  app.locals.pretty = false;
  app.locals.compileDebug = false;
  // Stream Express Logging to Winston
  app.use(logger({
    stream: {
      write: function (message, encoding) {
        winston.info(message);
      }
    }
  }));
  // Enable If behind nginx, proxy, or a load balancer (e.g. Heroku, Nodejitsu).
  app.enable('trust proxy');
  // Since our application has signup, login, etc. forms these should be protected
  // with SSL encryption. Heroku, Nodejitsu and other hosters often use reverse
  // proxies or load balancers which offer SSL endpoints (but then forward unencrypted
  // HTTP traffic to the server).  This makes it simpler for us since we don't have to
  // setup HTTPS in express. When in production we can redirect all traffic to SSL
  // by using a little middleware.
  //
  // In case of a non-encrypted HTTP request, enforce.HTTPS() automatically
  // redirects to an HTTPS address using a 301 permanent redirect. BE VERY
  // CAREFUL with this! 301 redirects are cached by browsers and should be
  // considered permanent.
  //
  // NOTE: Use `enforce.HTTPS(true)` if you are behind a proxy or load
  // balancer that terminates SSL for you (e.g. Heroku, Nodejitsu).
  app.use(enforce.HTTPS(true));
}

// Port to listen on.
app.set('port', config.port);

// Favicon - This middleware will come very early in your stack
// (maybe even first) to avoid processing any other middleware
// if we already know the request is for favicon.ico
app.use(favicon(__dirname + '/public/favicon.ico'));

// Setup the view engine (jade)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Compress response data with gzip / deflate.
// This middleware should be placed "high" within
// the stack to ensure all responses are compressed.
app.use(compress());

// http://en.wikipedia.org/wiki/HTTP_ETag
// Google has a nice article about "strong" and "weak" caching.
// It's worth a quick read if you don't know what that means.
// https://developers.google.com/speed/docs/best-practices/caching
app.set('etag', true);  // other values 'weak', 'strong'

// Body parsing middleware supporting
// JSON, urlencoded, and multipart requests.
app.use(bodyParser());

// Easy form validation!
app.use(expressValidator());

// If you want to simulate DELETE and PUT
// in your app you need methodOverride.
app.use(methodOverride());

// CookieParser is required before session.  Session data is
// not saved in the cookie itself, however cookies are used,
// so we must use the cookie-parser middleware before session().
// Use a secret for signed cookies.
app.use(cookieParser(config.cookie.secret));
app.use(session(config.session));

// Security Settings
app.disable('x-powered-by');          // Don't advertise our server type
app.use(csrf());                      // Prevent Cross-Site Request Forgery
app.use(helmet.contentTypeOptions()); // nosniff
app.use(helmet.ienoopen());           // X-Download-Options for IE8+
app.use(helmet.iexss());              // sets the X-XSS-Protection header
app.use(helmet.hsts());               // HTTP Strict Transport Security
app.use(helmet.xframe('deny'));       // Prevent iframe
app.use(helmet.crossdomain());        // crossdomain.xml

// Content Security Policy
// app.use(helmet.csp({
//   'default-src': ["'self'", 'localhost:3000'],
//   'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'", 'http://www.google-analytics.com', 'https://oss.maxcdn.com'],
//   'style-src': ["'self'", "'unsafe-inline'", 'http://fonts.googleapis.com'],
//   'img-src': ["'self'", 'http://pbs.twimg.com'], // defines the origins from which images can be loaded
//   'connect-src': ["'self'", 'ws://localhost:3000'], // limits the origins to which you can connect (via XHR, WebSockets, and EventSource)
//   'font-src': ["'self'", 'http://fonts.googleapis.com', 'http://themes.googleusercontent.com'], // specifies the origins that can serve web fonts
//   'object-src': ["'none'"],     // allows control over Flash and other plugins
//   'media-src': ["'self'"],      // restricts the origins allowed to deliver video and audio
//   'frame-src': ["'none'"],      // lists the origins that can be embedded as frames
//   'sandbox': ['allow-same-origin', 'allow-forms', 'allow-scripts'],  // http://www.html5rocks.com/en/tutorials/security/sandboxed-iframes/
//   'report-uri': ['/report-violation'],
//   reportOnly: true,             // set to true if you *only* want to report errors
//   setAllHeaders: false,         // set to true if you want to set all headers
//   safari5: false                // set to true if you want to force buggy CSP in Safari 5
// }));

// Passport OAUTH Middleware
app.use(passport.initialize());
app.use(passport.session());

// Keep user, csrf token and config available
app.use(function (req, res, next) {
  res.locals.user = req.user;
  res.locals.config = config;
  res.locals._csrf = req.csrfToken();
  next();
});

// Flash messages
app.use(flash());

/**
 * Routes/Routing
 */

// Dynamically include routes (via controllers)
fs.readdirSync('./controllers').forEach(function (file) {
  if (file.substr( -3 ) === '.js') {
    var route = require('./controllers/' + file);
    route.controller(app);
  }
});

// Now setup serving static assets from /public

// time in milliseconds...
var minute = 1000 * 60;   //     60000
var hour = (minute * 60); //   3600000
var day  = (hour * 24);   //  86400000
var week = (day * 7);     // 604800000

app.use(serveStatic(__dirname + '/public', { maxAge: week }));

/**
 * Error Handling
 */

// If nothing responded above we will assume a 404 (no routes responded or static assets found)
// Tests:
//   $ curl http://localhost:3000/notfound
//   $ curl http://localhost:3000/notfound -H "Accept: application/json"
//   $ curl http://localhost:3000/notfound -H "Accept: text/plain"

// Handle 404 Errors
app.use(function (req, res, next) {
  winston.warn('404 Warning. URL: ' + req.url + '\n');
  res.status(404);
  // respond with html page
  if (req.accepts('html')) {
    res.render('error/404', {
      url: req.url
    });
    return;
  }
  // respond with json
  if (req.accepts('json')) {
    res.send({ error: 'Not found' });
    return;
  }
  // default to plain-text. send()
  res.type('txt').send('Error: Not found');
});

// True error-handling middleware requires an arity of 4,
// aka the signature (err, req, res, next).

// Handle 403 Errors
app.use(function (err, req, res, next) {
  if (err.status === 403) {
    winston.error('403 Not Allowed. ' + err + '\n');
    // Respond with HTML
    if (req.accepts('html')) {
      res.status(err.status);
      res.render('error/403', {
        error: err,
        url: req.url
      });
      return;
    }
    // Respond with json
    if (req.accepts('json')) {
      res.send({ error: 'Not Allowed!' });
      return;
    }
    // Default to plain-text. send()
    res.type('txt').send('Error: Not Allowed!');
  } else {
    // Since the error is not a 403 pass it along
    return next(err);
  }
});

// Production 500 error handler (no stacktraces leaked to public!)
if (app.get('env') === 'production') {
  app.use(function (err, req, res, next) {
    winston.error(err.status || 500 + ' ' + err + '\n');
    res.status(err.status || 500);
    res.render('error/500', {
      error: {},
    });
  });
}

// Development 500 error handler
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    winston.error(err.status || 500 + ' ' + err + '\n');
    res.status(err.status || 500);
    res.render('error/500', {
      error: err,
    });
  });
  // Final error catch-all just in case...
  app.use(errorHandler({ dumpExceptions: true, showStack: true }));
}

/**
 * Start Express server.
 */

// NOTE: To alter the environment we can set the
// NODE_ENV environment variable, for example:

// $ NODE_ENV=production node app.js

// This is *very* important, as many caching mechanisms
// are *only* enabled when in production!

db.on('error', function () {
  winston.error('Mongodb connection error!');
  console.error('✗ MongoDB Connection Error. Please make sure MongoDB is running.'.red.bold);
  // testing debug functionality
  debug('✗ MongoDB Connection Error. Please make sure MongoDB is running.'.red.bold);
  process.exit(0);
});

db.on('open', function () {
  winston.info('Mongodb connected!');
  console.log('✔ Mongodb ' + 'connected!'.green.bold);

  // "server.listen" for socket.io
  server.listen(app.get('port'), function() {

    // Test for correct node version as spec'ed in package.info
    if (!semver.satisfies(process.versions.node, config.nodeVersion)) {
      winston.error(config.name + ' needs Node version ' + config.nodeVersion);
      console.error(
        '\nERROR: Unsupported version of Node!'.red.bold,
        '\n✗ '.red.bold + config.name.red.bold + ' needs Node version'.red.bold,
        config.nodeVersion.yellow.bold,
        'you are using version'.red.bold,
        process.versions.node.yellow.bold,
        '\n✔ Please go to http://nodejs.org to get a supported version.'.red.bold
      );
      process.exit(0);
    }

    // Log how we are running
    winston.info(config.name + ' listening on port ' + app.get('port'),
      'in ' + app.settings.env + ' mode.'
    );
    console.log(
      '✔ ' + config.name + ' listening on port ' + app.get('port').toString().green.bold,
      'in ' + app.settings.env.green.bold + ' mode.',
      '\n✔ Hint: ' + 'Ctrl+C'.green.bold + ' to shut down.'
    );

    // Exit cleanly on Ctrl+C
    process.on('SIGINT', function () {
      winston.info(config.name + ' has shudown.');
      console.log(
        '\n✔ ' + config.name + ' has ' + 'shutdown'.green.bold,
        '\n✔ ' + config.name + ' was running for ' + Math.round(process.uptime()).toString().green.bold + ' seconds.'
      );
      process.exit(0);
    });
  });
});

/**
 * Emit Pageviews on Socket.io for Dashboard
 *
 * Web Page (Client) --->> ( `pageview` messages ) --->> Server
 * Web Page (Client) <<--- (`dashUpdate` messages) <<--- Server
 */

var connectedCount = 0;

io.on('connection', function (socket) {
  connectedCount += 1;
  // Listen for pageview messages from clients
  socket.on('pageview', function (message) {
    var ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address.address;
    var url = message;
    // Broadcast dashboard update (to all clients in default namespace)
    io.emit('dashUpdate', {
      connections: connectedCount,
      ip: ip,
      url: url,
      timestamp: new Date()
    });
  });
  // Update dashboard connections on disconnect events
  socket.on('disconnect', function () {
    connectedCount -= 1;
    io.emit('dashUpdate', {
      connections: connectedCount
    });
  });
});
