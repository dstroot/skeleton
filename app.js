'use strict';

/**
 * Module Dependencies
 */

var fs                = require('fs');                     // http://nodejs.org/docs/v0.10.25/api/fs.html
var io                = require('socket.io');              // https://www.npmjs.org/package/socket.io
var pkg               = require('./package.json');         // Get package.json
var path              = require('path');                   // http://nodejs.org/docs/v0.10.25/api/path.html
var flash             = require('express-flash');          // https://npmjs.org/package/express-flash
var config            = require('./config/config');       // Get configuration
var semver            = require('semver');                 // https://npmjs.org/package/semver
var helmet            = require('helmet');                 // https://github.com/evilpacket/helmet
var express           = require('express');                // https://npmjs.org/package/express
var winston           = require('winston');                // https://npmjs.org/package/winston
var mongoose          = require('mongoose');               // https://npmjs.org/package/mongoose
var passport          = require('passport');               // https://npmjs.org/package/passport
var MongoStore        = require('connect-mongo')(express); // https://npmjs.org/package/connect-mongo
var expressValidator  = require('express-validator');      // https://npmjs.org/package/express-validator

/**
 * Create Express Server and socket.io listener
 */

var app     = module.exports = express(),  // export app for testing
    server  = require('http').createServer(app),
    io      = io.listen(server);

/**
 * Configure Logging
 */

if ( config.logging ) {
  winston.add(winston.transports.File, { filename: config.logfilename });
  // TODO: Logging in production should be directed to a logging service
  // such as loggly.com or to a log server or database.
}

// Turn off Winston console logging, we will use Express instead
winston.remove(winston.transports.Console);

/**
 * Configure Database
 */

mongoose.connect(config.mongodb.url);
var db = mongoose.connection;

/**
 * Express Configuration and Setup
 */

// Application local variables are provided to *all* templates
// rendered within the application. personally I would have called
// them "app.globals". They are useful for providing helper
// functions to templates, as well as global app-level data.

// NOTE: you must not reuse existing (native) named properties
// for your own variable names, such as name, apply, bind, call,
// arguments, length, and constructor.

app.locals({
  application: config.name,
  version: config.version,
  description: config.description,
  author: config.author,
  keywords: config.keywords,
  ga: config.ga,
  // Now you can use moment anywhere
  // within a jade template like this:
  // p #{moment(Date.now()).format('MM/DD/YYYY')}
  // evergreen copyright ;)
  moment: require('moment'),
  // Jade options
  pretty: false,
  compileDebug: false
});

// Settings for development
if ( app.get('env') === 'development') {
  // Don't minify html in dev, use debug intrumentation
  app.locals({ pretty: true, compileDebug: true });
  // Turn on console logging in development
  app.use(express.logger('dev'));
}

// port to listen on
app.set('port', config.port);

// set favicon location
app.use(express.favicon(__dirname + '/public/favicon.ico'));

// Setup the view engine (jade)
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

// Body parsing middleware supporting
// JSON, urlencoded, and multipart requests.
app.use(express.json());
app.use(express.urlencoded());

// Easy form validation!
// Must be immediately after app.use(express.urlencoded());
app.use(expressValidator());

// If you want to simulate DELETE and PUT
// in your app you need methodOverride
app.use(express.methodOverride());

// Session (use a cookie and persist session in Mongo)
app.use(express.cookieParser(config.session.secret));
app.use(express.session({
  secret: config.session.secret,
  cookie: {
    httpOnly: true,           // Reduce XSS attack vector
    maxAge: config.session.maxAge
  },
  store: new MongoStore({
    mongoose_connection: db,
    auto_reconnect: true
  })
}));

// Security
app.use(express.csrf());      // prevent Cross-Site Request Forgery
helmet.defaults(app);         // default helmet security (must be above `app.router`)
app.disable('x-powered-by');  // Don't advertise our server type

// Passport OAUTH Middleware
app.use(passport.initialize());
app.use(passport.session());

// Keep user, csrf token and config available
app.use(function(req, res, next) {
  res.locals.user = req.user;
  res.locals.token = req.csrfToken();
  res.locals.config = config;
  next();
});

// for flash messages
app.use(flash());

// "app.router" positioned above the middleware defined below, this
// means that Express will match & call routes before continuing on.
app.use(app.router);

// Now setup our static serving from /public
app.use(express.static(path.join(__dirname, 'public'), { maxAge: config.session.maxAge }));

// If nothing responded above we can assume 404 (no routes responded or static assets found)

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
  winston.error(err.status || 500 + ' ' + err + '\n');
  res.status(err.status || 500);
  res.render('error/500', {
    error: err,
  });
});

// final error catch-all just in case
if ( app.get('env') === 'development') {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}

// Robots...
// www.robotstxt.org/
// www.google.com/support/webmasters/bin/answer.py?hl=en&answer=156449
app.configure('development', function() {
  // In dev, keep search engines out
  app.all('/robots.txt', function(req,res) {
    res.charset = 'text/plain';
    res.send('User-agent: *\nDisallow: /');
  });
});

app.configure('production', function() {
  // Allow all search engines
  app.all('/robots.txt', function(req,res) {
    res.charset = 'text/plain';
    res.send('User-agent: *');
  });
});

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
  console.log('✔ Mongodb ' + 'connected!'.green.bold);

  // "server.listen" for socket.io
  server.listen(app.get('port'), function() {

    // Test for correct node version as spec'ed in package.info
    if (!semver.satisfies(process.versions.node, pkg.engines.node)) {
      winston.error(config.name + ' needs Node version ' + pkg.engines.node);
      console.error(
        '\nERROR: Unsupported version of Node!'.red.bold,
        '\n✗ '.red.bold + config.name.red.bold + ' needs Node version'.red.bold,
        pkg.engines.node.yellow.bold,
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
 * https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO
 *
 */

io.configure('production', function() {
  io.enable('browser client minification');  // send minified client
  io.enable('browser client etag');          // apply etag caching logic based on version number
  io.enable('browser client gzip');          // gzip the file
  io.set('log level', 0);                    // reduce logging
  io.set('polling duration', 20);            // increase polling frequency
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
  io.set('log level', 2);                    // increase logging
  io.set('transports', [
    'websocket'                              // Let's use only websockets for development
  ]);
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

