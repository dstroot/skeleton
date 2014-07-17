'use strict';

// Install: you must install gulp both globally *and* locally.
// Make sure you `$ npm install -g gulp`

/* -------------------------------------------------------------
Gulp BrowserSync Version
----------------------------------------------------------------
This is designed to reload the web page as you develop so you can
instantly see your changes.  This is an alternative to livereload.

Known Issues:
 - Since browserSync also uses socketio there is a conflict -
   the dashboard in the app does not work via the browserSync
   proxy. (you can still use localhost:3000 and it works).
 - The timings for nodemon require playing around to get them
   working right.  Start with a long timing and work it down.
   If it's not long enough the app will hang in the browser.
 - Doesn't seem to work reliably unless you *already* have a
   Browser open.
--------------------------------------------------------------- */

/* -------------------------------------------------------------
Notes
----------------------------------------------------------------
By default, all gulp tasks run with maximum concurrency --
e.g. gulp launches all the tasks at once and waits for nothing.

If you want to create a series where tasks run in a particular
order, you need to do two things:

1. Give it a hint to tell it when the task is done. This can be
   done by using a callback or `return`ing the stream.

     // Takes in a callback so that gulp knows when it'll be done
     gulp.task('one', function(cb) {
       // do stuff -- async or otherwise
       cb(err); // if err is not null and not undefined, the orchestration will stop, and 'two' will not run
     });

     // Return the stream so that gulp knows when it'll be done
     gulp.task('one', function() {
       return gulp.src(['src/styles/app.less'])
    // ^^^^^^ - boom!
         .pipe($.less({}))
         .pipe(gulp.dest('output/css/app.css'));
     });

2. Tell it which tasks depend on completion of other tasks.
   Dependent tasks are passed in as an array, task 'two'
   depends on 'one':

    gulp.task('two', ['one'], function() {
      // task 'one' is done now
    });

Docs:
https://github.com/gulpjs/gulp/blob/master/docs/API.md#async-task-support
https://github.com/gulpjs/gulp/blob/master/docs/recipes/running-tasks-in-series.md
http://cameronspear.com/blog/handling-sync-tasks-with-gulp-js/
--------------------------------------------------------------- */

/**
 * Dependencies
 */

var gulp = require('gulp');
// load gulp plugins
var $ = require('gulp-load-plugins')();
// User browserSync
var browserSync = require('browser-sync');
var reload = browserSync.reload;
// Runs a sequence of gulp tasks in the specified order
var runSequence = require('run-sequence');

/**
 * Banner
 */

var pkg = require('./package.json');
var banner = [
  '/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version v<%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @license <%= pkg.license %>',
  ' */',
  ''
].join('\n');

/**
 * Paths
 */

var paths = {
  clean: [
    '!public/js/main.js',            // ! not
    '!public/js/socket.io-1.0.6.js', // ! not
    'public/js/**/*.js',
    'public/js/**/*.map',
    'public/js/**/*.min.js',
    'public/css/**/*.css',
    'public/css/**/*.min.css'
  ],
  js: [
    // ============= Bootstrap  ================
    // Enable/disable as needed but only turn on
    // .js that is needed on *every* page. No bloat!
    // =========================================
    'public/lib/bootstrap/js/transition.js',
    'public/lib/bootstrap/js/alert.js',
    // 'public/lib/bootstrap/js/button.js',
    // 'public/lib/bootstrap/js/carousel.js',
    'public/lib/bootstrap/js/collapse.js',
    'public/lib/bootstrap/js/dropdown.js',
    // 'public/lib/bootstrap/js/modal.js',
    // 'public/lib/bootstrap/js/tooltip.js',
    // 'public/lib/bootstrap/js/popover.js',
    // 'public/lib/bootstrap/js/scrollspy.js',
    // 'public/lib/bootstrap/js/tab.js',
    // 'public/lib/bootstrap/js/affix.js'
    // =========================================
    'public/lib/fastclick/lib/fastclick.js',
    'public/js/main.js'
  ],
  lint: [
    'config/**/*.js',
    'test/**/*.js',
    'controllers/**/*.js',
    'models/**/*.js',
    'app.js',
    'app_cluster.js',
    'gulpfile.js'
  ],
  less: [
    'less/**/*.less'
  ],
  jade: [
    'views/**/*.jade'
  ]
};

/**
 * Clean
 */

// Return the stream so that gulp knows the task is asynchronous
// and waits for it to terminate before starting dependent tasks.

gulp.task('clean', function () {
  return gulp.src(paths.clean, { read: false })
    .pipe($.rimraf());
});

/**
 * Process CSS
 */

gulp.task('styles', function () {
  return gulp.src('./less/main.less')       // Return the stream
    .pipe($.less({}))                       // Compile Less files
    .pipe($.autoprefixer([                  // Autoprefix target browsers
      'last 2 versions',
      '> 1%',
      'Firefox ESR',
      'Opera 12.1'
    ], { cascade: true }))
    .pipe($.rename(pkg.name + '.css'))      // Rename to "packagename.css"
    .pipe(gulp.dest('./public/css'))        // Save CSS here
    .pipe($.rename({ suffix: '.min' }))     // Add .min suffix
    .pipe($.csso())                         // Minify CSS
    .pipe($.header(banner, { pkg : pkg }))  // Add banner
    .pipe($.size({ title: 'CSS:' }))        // What size are we at?
    .pipe(gulp.dest('./public/css'))        // Save minified CSS
    .pipe(reload({ stream: true }));        // Initiate a reload
});

/**
 * Process Scripts
 */

gulp.task('scripts', function () {
  return gulp.src(paths.js)                 // Read .js files
    .pipe($.concat(pkg.name + '.js'))       // Concatenate .js files
    .pipe(gulp.dest('./public/js'))         // Save main.js here
    .pipe($.rename({ suffix: '.min' }))     // Add .min suffix
    .pipe($.uglify({ outSourceMap: true })) // Minify the .js
    .pipe($.header(banner, { pkg : pkg }))  // Add banner
    .pipe($.size({ title: 'JS:' }))         // What size are we at?
    .pipe(gulp.dest('./public/js'))         // Save minified .js
    .pipe(reload({ stream: true }));        // Initiate a reload
});

/**
 * Process Images
 */

gulp.task('images', function () {
  return gulp.src('public/img/**/*')        // Read images
    .pipe($.changed('./public/img'))        // Only process new/changed
    .pipe($.imagemin({
      optimizationLevel: 5,
      progressive: true,
      interlaced: true
    }))
    .pipe(gulp.dest('./public/img'));      // Write processed images
});

/**
 * JSHint Files
 */

gulp.task('lint', function () {
  return gulp.src(paths.lint)               // Read .js files
    .pipe($.jshint())                       // Lint .js files
    .pipe($.jshint.reporter($.stylish))     // Specify a reporter for JSHint
    .pipe($.jshint.reporter($.fail));
});

/**
 * JSCS Files
 */

gulp.task('jscs', function () {
  // Monkey business to handle jscs errors without stopping gulp
  var j = $.jscs();
  j.on('error', function (e) {
    // $.util.log(e);
    j.end();
  });
  return gulp.src(paths.lint)
    .pipe(j);
});

/**
 * Nodemon Task
 *   - Restarts Nodejs when .js files change
 */

gulp.task('nodemon', function (cb) {
  var called = false;
  $.nodemon({
    script: 'app.js',
    verbose: false,
    env: { 'NODE_ENV': 'development' },
    // nodeArgs: ['--debug'],
    ext: 'js',
    ignore: [
      'gulpfile.js',
      'public/',
      'views/',
      'less/',
      'node_modules/'
    ]
  })
  .on('start', function () {
    setTimeout(function () {
      if (!called) {
        called = true;
        console.log('start');
        cb();
      }
    }, 3500);  // adjust as needed
  })
  .on('restart', function () {
    setTimeout(function () {
      console.log('restart');
      reload();
    }, 3500);  // adjust as needed
  });
});

/**
 * BrowserSync
 *   - automatic reloads without livereload!
 */

gulp.task('browser-sync', ['nodemon'], function () {
  browserSync({
    // local node app address
    proxy: 'localhost:3000',
    // browserSync port, make sure it *does not* conflict with node app
    port: 5000,
    // Reload otifications in the browser.
    notify: true,
    // Wait for 0.2 seconds since the last file changed to actually reload the browser
    // debounce: 200,
    // Wait for 1 seconds before any browsers should try to inject/reload a file.
    // reloadDelay: 1000
    ghostMode: {
      links: false
    }
  });
});

/**
 * Build Task
 *   - Build all the things...
 */

gulp.task('build', function (cb) {
  runSequence(
    'clean',           // first clean
    ['lint', 'jscs'],  // then lint and jscs in parallel
    ['styles', 'scripts', 'images'], // etc.
    'browser-sync',
    cb);
});

/**
 * Default Task
 */

gulp.task('default', ['build'], function () {
  gulp.watch(paths.jade, reload);
  gulp.watch(paths.less, ['styles']);
  gulp.watch(paths.js, ['scripts']);
  gulp.watch(paths.lint, ['lint', 'jscs']);
});

