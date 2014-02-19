'use strict';

/**
 * Module Dependencies
 */

var express           = require('express');                // https://npmjs.org/package/express
var MongoStore        = require('connect-mongo')(express); // https://npmjs.org/package/connect-mongo
var flash             = require('express-flash');          // https://npmjs.org/package/express-flash
var fs                = require('fs');                     // http://nodejs.org/docs/v0.10.25/api/fs.html
var io                = require('socket.io');              // https://www.npmjs.org/package/socket.io
var path              = require('path');                   // http://nodejs.org/docs/v0.10.25/api/path.html
var mongoose          = require('mongoose');               // https://npmjs.org/package/mongoose
var passport          = require('passport');               // https://npmjs.org/package/passport
var expressValidator  = require('express-validator');      // https://npmjs.org/package/express-validator
var winston           = require('winston');                // https://npmjs.org/package/winston
//The semver parser that node uses. See http://semver.org/
var semver            = require('semver');                 // https://npmjs.org/package/semver
// Helmet is middleware for Express/Connect apps that implements
// various security headers to make your app more secure.
var helmet            = require('helmet');                 // https://github.com/evilpacket/helmet
var pkg               = require('./package.json');         // Get package.json
var config            = require('./config/config');        // Get configuration
// var passportConf      = require('./config/passport');      // Get passport.js setup

/**
 * Static Variables
 */

var hour  = 3600000;
var day   = (hour * 24);
var week  = (day * 7);

/**
 * Create Express Server and socket.io listener
 */

var app     = express(),
    server  = require('http').createServer(app),
    io      = io.listen(server);

/**
 * Configure Logging
 */

if ( config.logging ) {
  winston.add(winston.transports.File, { filename: config.logfilename });
}
// Turn off Winston Console Logging, we will use Express instead
winston.remove(winston.transports.Console);

// TODO: Logging in production should be directed to a logging service
// such as loggly.com or to a log server or database.

/**
 * Configure Database
 */

mongoose.connect(config.mongodb.url);
var db = mongoose.connection;

/**
 * Express Configuration and Setup
 */

// Application local variables are provided to *all* templates
// rendered within the application. This is useful for providing
// helper functions to templates, as well as app-level data

// NOTE: you must not reuse existing (native) named properties
// for your own variable names, such as name, apply, bind, call,
// arguments, length, constructor.

app.locals({
  title: pkg.name,
  version: pkg.version,
  // Now you can use moment anywhere
  // within a jade template like this:
  // p #{moment(Date.now()).format('MM/DD/YYYY')}
  moment: require('moment'),
  pretty: false
});

// Settings for development
if ( app.get('env') === 'development') {
  // Don't minify in dev
  app.locals({ pretty: true });
  // Turn on console logging in development
  app.use(express.logger('dev'));
}

// port to listen on
app.set('port', config.port);

// set favicon location
app.use(express.favicon(__dirname + '/public/favicon.ico'));

// Setup view engine (jade)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Enable If behind nginx!
// app.enable('trust proxy');

// Compress response data with gzip / deflate.
// This middleware should be placed "high" within
// the stack to ensure all responses are compressed.
app.use(express.compress());

// Stream Express Logging to Winston
app.use(express.logger({
  stream: {
    write: function (message, encoding) {
      winston.info(message);
    }
  }
}));

// Request body parsing middleware supporting
// JSON, urlencoded, and multipart requests.
app.use(express.json());
app.use(express.urlencoded());

// Must be immediately after app.use(express.urlencoded());
// Easy form validation
app.use(expressValidator());

// If you want to simulate DELETE and PUT: methodOverride
app.use(express.methodOverride());

// Session
app.use(express.cookieParser(config.session.secret));
app.use(express.session({
  secret: config.session.secret,
  key: config.session.key,
  store: new MongoStore({
    mongoose_connection: db,
    auto_reconnect: true
  }),
  cookie: {
    httpOnly: true,
    maxAge: week
  }
}));

// Security
app.use(express.csrf());      // prevent Cross-Site Request Forgery
helmet.defaults(app);         // default helmet security (must be above `app.router`)
app.disable('x-powered-by');  // Don't advertise our server

// Passport OAUTH Middleware
app.use(passport.initialize());
app.use(passport.session());

// Keep user information and csrf token available
app.use(function(req, res, next) {
  res.locals.user = req.user;
  res.locals.token = req.csrfToken();
  next();
});

// for flash messages
app.use(flash());

// "app.router" positioned above the middleware defined below,
// this means that Express will attempt to match & call
// routes before continuing on.
app.use(app.router);

// Then we do our static serving from /public
app.use(express.static(path.join(__dirname, 'public'), { maxAge: week }));

// Assume 404, as no routes responded or static assets found

// Test:
// $ curl http://localhost:3000/notfound
// $ curl http://localhost:3000/notfound -H "Accept: application/json"
// $ curl http://localhost:3000/notfound -H "Accept: text/plain"

// Handle 404 Errors
app.use(function(req, res, next) {
  winston.warn('404 Warning. URL: ' + req.url + '\n');
  res.status(404);
  // respond with html page
  if (req.accepts('html')) {
    res.render('error/404', {
      url: req.url,
      title: app.locals.title
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

// Error-handling middleware requires an arity of 4, aka the signature (err, req, res, next).
// when connect has an error, it will invoke ONLY error-handling middleware.

// Handle 403 Errors
app.use(function(err, req, res, next) {
  if (err.status === 403) {
    winston.error('403 Not Allowed. ' + err + '\n');
    // Respond with HTML
    if (req.accepts('html')) {
      res.status(err.status);
      res.render('error/403', {
        error: err,
        url: req.url,
        title: app.locals.title
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

// Handle 500 Errors (really anything not handled above)
app.use(function(err, req, res, next) {
  // we may use properties of the error object here and next(err) appropriately,
  // or if we possibly recovered from the error, simply next().
  winston.error(err.status || 500 + ' ' + err + '\n');
  res.status(err.status || 500);
  res.render('error/500', {
    error: err,
    url: req.url,
    title: app.locals.title
  });
});

// final catch-all just in case
if ( app.get('env') === 'development') {
  app.use(express.errorHandler());
}

/**
 * Dynamically include routes (via controllers)
 */

fs.readdirSync('./controllers').forEach(function (file) {
  if (file.substr( -3 ) === '.js') {
    var route = require('./controllers/' + file);
    route.controller(app);
  }
});

/**
 * Start Express server.
 */

// NOTE: To alter the environment we can set the
// NODE_ENV environment variable, for example:

// $ NODE_ENV=production node cluster_app.js

// This is *very* important, as many caching mechanisms
// are *only* enabled when in production!

db.on('error', function () {
  winston.error('Mongodb connection error!');
  console.error('✗ MongoDB Connection Error. Please make sure MongoDB is running.'.red.bold);
  process.exit(0);
});

db.on('open', function () {
  winston.info('Mongodb connected!');
  console.log("✔ Mongodb " + "connected!".green.bold);
  // server for socket.io
  server.listen(app.get('port'), function() {
  //app.listen(app.get('port'), function() {

    // Test for correct node version as spec'ed in package.info
    if (!semver.satisfies(process.versions.node, pkg.engines.node)) {
      winston.error(pkg.name + ' needs Node version ' + pkg.engines.node);
      console.error(
        "\nERROR: Unsupported version of Node!".red.bold,
        "\n✗ ".red.bold + pkg.name.red.bold + " needs Node version".red.bold,
        pkg.engines.node.yellow.bold,
        "you are using version".red.bold,
        process.versions.node.yellow.bold,
        "\n✔ Please go to http://nodejs.org to get a supported version.".red.bold
      );
      process.exit(0);
    }

    // Note how we are running
    winston.info(pkg.name + ' listening on port ' + app.get('port'),
      "in " + app.settings.env + " mode."
    );
    console.log(
      "✔ " + pkg.name + " listening on port " + app.get('port').toString().green.bold,
      "in " + app.settings.env.green.bold + " mode.",
      "\n✔ Hint: " + "Ctrl+C".green.bold + " to shut down."
    );

    // Exit cleanly on Ctrl+C
    process.on('SIGINT', function () {
      winston.info(pkg.name + ' has shudown.');
      console.log(
        "\n✔ " + pkg.name + " has " + "shutdown".green.bold,
        "\n✔ " + pkg.name + " was running for " + Math.round(process.uptime()).toString().green.bold + " seconds."
      );
      process.exit(0);
    });
  });
});

/**
 * Emit Pageviews on Socket.io
 */

io.configure('production', function() {
  io.enable('browser client minification');  // send minified client
  io.enable('browser client etag');          // apply etag caching logic based on version number
  io.enable('browser client gzip');          // gzip the file
  io.set('log level', 1);                    // reduce logging
  io.set("polling duration", 10);            // increase polling frequency
  io.set('transports', [                     // Manage transports
    'websocket',
    'htmlfile',
    'xhr-polling',
    'jsonp-polling'
  ]);
  io.set('authorization', function (handshakeData, callback) {
    if (handshakeData.xdomain) {
      callback('Cross-domain connections are not allowed');
    } else {
      callback(null, true);
    }
  });
});

io.configure('development', function() {
  io.set('log level', 1);                    // reduce logging
  io.set('transports', [
    'websocket'                              // Let's just use websockets for development
  ]);
  io.set('authorization', function (handshakeData, callback) {
    if (handshakeData.xdomain) {
      callback('Cross-domain connections are not allowed');
    } else {
      callback(null, true);
    }
  });
});

io.sockets.on('connection', function (socket) {
  socket.on('message', function (message) {
    var ip = socket.handshake.address.address;
    var url = message;
    io.sockets.emit('pageview', { 'connections': Object.keys(io.connected).length, 'ip': ip, 'url': url, 'xdomain': socket.handshake.xdomain, 'timestamp': new Date()});
  });
  socket.on('disconnect', function () {
    io.sockets.emit('pageview', { 'connections': Object.keys(io.connected).length});
  });
});

