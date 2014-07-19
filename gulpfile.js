'use strict';

// Install: you must install gulp both globally *and* locally.
// Make sure you `$ npm install -g gulp`

/**
 * Dependencies
 */

var gulp = require('gulp');
var $ = require('gulp-load-plugins')({ lazy: true });
var runSequence = require('run-sequence');
var terminus = require('terminus');
var pagespeed = require('psi');

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
  return gulp.src('./less/main.less')       // Read in Less file
    .pipe($.sourcemaps.init())              // Initialize gulp-sourcemaps
    .pipe($.less({ strictMath: true }))     // Compile Less files
    .pipe($.autoprefixer([                  // Autoprefix for target browsers
      'last 2 versions',
      '> 1%',
      'Firefox ESR',
      'Opera 12.1'
    ], { cascade: true }))
    .pipe($.csscomb())                      // Coding style formatter for CSS
    // .pipe($.csslint('.csslintrc'))          // Lint CSS
    // .pipe($.csslint.reporter())             // Report issues
    .pipe($.rename(pkg.name + '.css'))      // Rename to "packagename.css"
    .pipe($.sourcemaps.write())             // Write sourcemap
    .pipe(gulp.dest('./public/css'))        // Save CSS here
    .pipe($.rename({ suffix: '.min' }))     // Add .min suffix
    .pipe($.csso())                         // Minify CSS
    .pipe($.header(banner, { pkg : pkg }))  // Add banner
    .pipe($.size({ title: 'CSS:' }))        // What size are we at?
    .pipe(gulp.dest('./public/css'))        // Save minified CSS
    .pipe($.livereload());                  // Initiate a reload
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
    .pipe($.livereload());                  // Initiate a reload
});

/**
 * Process Images
 */

gulp.task('images', function () {
  return gulp.src('public/img/**/*')        // Read images
    .pipe($.changed('./public/img'))        // Only process new/changed
    .pipe($.imagemin({                      // Compress images
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
    .pipe($.jshint())                       // lint .js files
    .pipe($.jshint.reporter($.stylish));    // Use stylish reporter
});

/**
 * JSCS Files
 */

gulp.task('jscs', function () {
  // Monkey business to handle jscs errors without
  // stopping gulp, allowing gulp.watch to work
  var j = $.jscs();
  j.on('error', function (e) {
    $.util.log(e.message);
    j.end();
  });
  return gulp.src(paths.lint)               // Read .js files
    .pipe(j)                                // jscs .js files
    .pipe(terminus.devnull({ objectMode: true }));
});

/**
 * Build Task
 *   - Build all the things...
 */

gulp.task('build', function (cb) {
  runSequence(
    'clean',                                // first clean
    ['lint', 'jscs'],                       // then lint and jscs in parallel
    ['styles', 'scripts', 'images'],        // etc.
    cb);
});

/**
 * Nodemon Task
 */

gulp.task('nodemon', ['build'], function (cb) {
  $.livereload.listen();
  var called = false;
  $.nodemon({
    script: 'app.js',
    verbose: false,
    // env: { 'NODE_ENV': 'development' },
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
        cb();
      }
    }, 3000);  // wait for start
  })
  .on('restart', function () {
    setTimeout(function () {
      $.livereload.changed('/');
    }, 3000);  // wait for restart
  });
});

/**
 * Open the browser
 */

gulp.task('open', ['nodemon'], function () {
  var options = {
    url: 'http://localhost:3000/'
  };
  // A file must be specified or gulp will skip the task
  // Doesn't matter which file since we set the URL above
  // Weird, I know...
  gulp.src('./public/humans.txt')
  .pipe($.open('', options));
});

/**
 * Default Task
 */

gulp.task('default', ['open'], function () {
  gulp.watch(paths.less, ['styles']);
  gulp.watch(paths.js, ['scripts']);
  gulp.watch(paths.lint, ['lint', 'jscs']);
  gulp.watch('views/**/*.jade').on('change', $.livereload.changed);
});

/**
 * Run PageSpeed Insights
 */

// By default, we use the PageSpeed Insights
// free (no API key) tier. You can use a Google
// Developer API key if you have one. See
// http://goo.gl/RkN0vE for info key: 'YOUR_API_KEY'

gulp.task('pagespeed', pagespeed.bind(null, {
  url: 'https://skeleton-app.jit.su',
  strategy: 'desktop'
}));
