'use strict';

/**
 * Module Dependencies
 */

// Express 4.x Modules
var csrf              = require('csurf');                   // https://github.com/expressjs/csurf
var morgan            = require('morgan');                  // https://github.com/expressjs/morgan
var express           = require('express');                 // https://npmjs.org/package/express
var favicon           = require('serve-favicon');           // https://github.com/expressjs/favicon
var session           = require('express-session');         // https://github.com/expressjs/session
var compress          = require('compression');             // https://github.com/expressjs/compression
var bodyParser        = require('body-parser');             // https://github.com/expressjs/body-parser
var errorHandler      = require('errorhandler');            // https://github.com/expressjs/errorhandler
var methodOverride    = require('method-override');         // https://github.com/expressjs/method-override

// Additional Modules
var fs                = require('fs');                      // http://nodejs.org/docs/v0.10.25/api/fs.html
var path              = require('path');                    // http://nodejs.org/docs/v0.10.25/api/path.html
var debug             = require('debug')('skeleton');       // https://github.com/visionmedia/debug
var flash             = require('express-flash');           // https://npmjs.org/package/express-flash
var config            = require('./config/config');         // Get configuration file
var logger            = require('express-loggly');          // https://github.com/dstroot/express-loggly
var helmet            = require('helmet');                  // https://github.com/evilpacket/helmet
var semver            = require('semver');                  // https://npmjs.org/package/semver
var enforce           = require('express-sslify');          // https://github.com/florianheinemann/express-sslify
var mongoose          = require('mongoose');                // https://npmjs.org/package/mongoose
var passport          = require('passport');                // https://npmjs.org/package/passport
var MongoStore        = require('connect-mongo')(session);  // https://npmjs.org/package/connect-mongo
var expressValidator  = require('express-validator');       // https://npmjs.org/package/express-validator

/**
 * Create Express app, HTTP server and socket.io listener
 */

var app    = module.exports = express();  // export app for testing ;)
var server = require('http').Server(app);
var io     = require('socket.io')(server);

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
// rendered within the application. (personally I would have called
// them "app.globals") They are useful for providing helper
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

// Format dates/times in jade templates
// Use moment anywhere within a jade template like this:
// p #{moment(Date.now()).format('MM/DD/YYYY')}
// http://momentjs.com/
// Good for an evergreen copyright ;)
app.locals.moment = require('moment');

// Format numbers in jade templates:
// Use numeral anywhere within a jade template like this:
// #{numeral('123456').format('$0,0.00')}
// http://numeraljs.com/
app.locals.numeral = require('numeral');

if (app.get('env') === 'development') {
  // Jade options: Don't minify html, debug intrumentation
  app.locals.pretty = true;
  app.locals.compileDebug = true;
  // Turn on console logging in development
  app.use(morgan('dev'));
  // Turn off caching in development
  // This sets the Cache-Control HTTP header to no-store, no-cache,
  // which tells browsers not to cache anything.
  app.use(helmet.nocache());
}

if (app.get('env') === 'production') {
  // Jade options: minify html, no debug intrumentation
  app.locals.pretty = false;
  app.locals.compileDebug = false;
  // Enable If behind nginx, proxy, or a load balancer (e.g. Heroku, Nodejitsu)
  app.enable('trust proxy', 1);  // trust first proxy
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
  // This tells browsers, "hey, only use HTTPS for the next period of time".
  // This will set the Strict Transport Security header, telling browsers to
  // visit by HTTPS for the next ninety days:
  // TODO: should we actually have this *and* app.use(enforce.HTTPS(true)); above?
  //       this seems more flexible rather than a hard redirect.
  var ninetyDaysInMilliseconds = 7776000000;
  app.use(helmet.hsts({ maxAge: ninetyDaysInMilliseconds }));
  // Turn on HTTPS/SSL cookies
  config.session.proxy = true;
  config.session.cookie.secure = true;
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
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// Easy form validation!
app.use(expressValidator());

// If you want to simulate DELETE and PUT
// in your app you need methodOverride.
app.use(methodOverride());

// Use sessions
// NOTE: cookie-parser not needed with express-session > v1.5
app.use(session(config.session));

/*
Thoughts on logging:

** DEVELOPMENT **

In development we can use the standard logger (morgan) and
debug (https://github.com/visionmedia/debug) for console output

Debug has an advantage over `console.log` because it only
outputs when you specifically start node with it enabled.

** PRODUCTION **

Personally I prefer to stream Express logging to a service
like Loggly or Papertrail.  That way I don't worry about
the file system, log shipping/rotating, etc.  Plus these
have useful features for analyzing the data.

If you want to log to a file in production you can do
as follows. (Be careful however because this can fill up
your file system unless you handle it properly.) Probably
best to use a tool like Winston.  But the easy way is
to send the morgan log stream to ./myLogFile.log:

// use {flags: 'w'} to open in write mode, 'a' = append
var logFile = fs.createWriteStream('./myLogFile.log', { flags: 'a' });
app.use(morgan('combined', { stream: logFile }));
*/

// Log requests to Loggly in production
// Needs to be below session and bodyParser in the stack
if (app.get('env') === 'production' && config.logging) {
  app.use(logger({
    loggly: config.loggly
  }));
}

// Security Settings
app.disable('x-powered-by');          // Don't advertise our server type
app.use(csrf());                      // Prevent Cross-Site Request Forgery
app.use(helmet.nosniff());            // Sets X-Content-Type-Options to nosniff
app.use(helmet.ienoopen());           // X-Download-Options for IE8+
app.use(helmet.xssFilter());          // sets the X-XSS-Protection header
app.use(helmet.xframe('deny'));       // Prevent iframe
app.use(helmet.crossdomain());        // crossdomain.xml

// Content Security Policy:
//   http://content-security-policy.com/
//   http://www.html5rocks.com/en/tutorials/security/content-security-policy/
//   http://www.html5rocks.com/en/tutorials/security/sandboxed-iframes/
//
//   NOTE: TURN THIS OFF DURING DEVELOPMENT
//   IT'S JUST PAINFUL OTHERWISE! OR DON'T
//   EVEN USE IT AT ALL - I JUST WANTED TO
//   LEARN HOW IT WORKS. :)

app.use(helmet.csp({
  defaultSrc: [
    "'self'"
  ],
  scriptSrc: [
    "'self'",
    "'unsafe-eval'",
    "'unsafe-inline'",
    'ajax.googleapis.com',
    'www.google-analytics.com',
    'oss.maxcdn.com',
    'cdn.socket.io',
    'checkout.stripe.com',
    'cdnjs.cloudflare.com'
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    'fonts.googleapis.com',
    'checkout.stripe.com'
  ],
  fontSrc: [
    "'self'",
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'themes.googleusercontent.com'
  ],
  imgSrc: [
    "'self'",
    'data:',
    'https://gravatar.com',
    'https://avatars.githubusercontent.com',
    'http://pbs.twimg.com',
    '*.4sqi.net',
    'http://*.media.tumblr.com',
    'http://userserve-ak.last.fm',
    'graph.facebook.com',
    '*.fbcdn.net',
    'fbcdn-profile-a.akamaihd.net',
    'github.global.ssl.fastly.net',
    'chart.googleapis.com',
    'www.google-analytics.com'
  ],
  mediaSrc: [
    "'self'"
  ],
  connectSrc: [ // limit the origins (via XHR, WebSockets, and EventSource)
    "'self'",
    'ws://localhost:5000',
    'ws://localhost:3000',
    'ws://127.0.0.1:35729/livereload',
    'wss://skeleton-app.jit.su',
    'api.github.com'
  ],
  objectSrc: [  // allows control over Flash and other plugins
    "'none'"
  ],
  frameSrc: [   // origins that can be embedded as frames
    'checkout.stripe.com'
  ],
  sandbox: [
    'allow-same-origin',
    'allow-forms',
    'allow-scripts'
  ],
  reportOnly: false,     // set to true if you *only* want to report errors
  setAllHeaders: false   // set to true if you want to set all headers
}));

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
  if (file.substr(-3) === '.js') {
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

app.use(express.static(__dirname + '/public', { maxAge: week }));

/**
 * Error Handling
 */

// If nothing responded above we will assume a 404
// (since no routes responded or static assets found)

// Tests:
//   $ curl http://localhost:3000/notfound
//   $ curl http://localhost:3000/notfound -H "Accept: application/json"
//   $ curl http://localhost:3000/notfound -H "Accept: text/plain"

// Handle 404 Errors
app.use(function (req, res, next) {
  res.status(404);
  debug('404 Warning. URL: ' + req.url);

  // Respond with html page
  if (req.accepts('html')) {
    res.render('error/404', { url: req.url });
    return;
  }

  // Respond with json
  if (req.accepts('json')) {
    res.send({ error: 'Not found!' });
    return;
  }

  // Default to plain-text. send()
  res.type('txt').send('Error: Not found!');

});

// True error-handling middleware requires an arity of 4,
// aka the signature (err, req, res, next).

// Handle 403 Errors
app.use(function (err, req, res, next) {
  if (err.status === 403) {
    res.status(err.status);
    debug('403 Not Allowed. URL: ' + req.url + ' Err: ' + err);

    // Respond with HTML
    if (req.accepts('html')) {
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
    res.status(err.status || 500);
    debug('Error: ' + (err.status || 500).toString().red.bold + ' ' + err);
    res.render('error/500', {
      error: {}  // don't leak information
    });
  });
}

// Development 500 error handler
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    debug('Error: ' + (err.status || 500).toString().red.bold + ' ' + err);
    res.render('error/500', {
      error: err
    });
  });

  // Final error catch-all just in case...
  app.use(errorHandler({ dumpExceptions: true, showStack: true }));
}

/*
 * Start Express server.
 *
 *   NOTE: To alter the environment we can set the
 *   NODE_ENV environment variable, for example:
 *
 *     $ NODE_ENV=production node app.js
 *
 *   This is important - many caching mechanisms
 *   are *only* enabled when in production!
 */

db.on('error', function () {
  debug('MongoDB Connection Error. Please make sure MongoDB is running.'.red.bold);
  process.exit(0);
});

db.on('open', function () {
  debug('Mongodb ' + 'connected!'.green.bold);

  // "server.listen" for socket.io
  server.listen(app.get('port'), function () {

    // Test for correct node version as spec'ed in package.info
    if (!semver.satisfies(process.versions.node, config.nodeVersion)) {
      debug('Error: unsupported version of Node!'.red.bold);
      debug(config.name.red.bold + ' needs Node version '.red.bold + config.nodeVersion.red.bold);
      process.exit(0);
    }

    // Log how we are running
    debug('listening on port ' + app.get('port').toString().green.bold);
    debug('listening in ' + app.settings.env.green.bold + ' mode.');
    debug('Ctrl+C'.green.bold + ' to shut down. ;)');

    // Exit cleanly on Ctrl+C
    process.on('SIGINT', function () {
      console.log('\n');
      debug('has ' + 'shutdown'.green.bold);
      debug('was running for ' + Math.round(process.uptime()).toString().green.bold + ' seconds.');
      process.exit(0);
    });
  });
});

/**
 * Emit Pageviews on Socket.io for Dashboard
 *
 *   Web Page (Client) --->> ( `pageview` messages ) --->> Server
 *   Web Page (Client) <<--- (`dashUpdate` messages) <<--- Server
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
