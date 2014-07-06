'use strict';

// Install: you must install gulp both globally *and* locally. Make sure you:
// $ npm install -g gulp

/**
 * Dependencies
 */

var gulp = require('gulp');
// load gulp plugins
var $ = require('gulp-load-plugins')();
// Use pagespeed
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

gulp.task('styles', ['clean'], function () {
  return gulp.src('./less/main.less')       // Return the stream
    .pipe($.less({}))                       // Compile Less files
    .pipe($.autoprefixer([                  // Autoprefix for target browsers
      'Android 2.3',
      'Android >= 4',
      'Chrome >= 20',
      'Firefox >= 24',
      'Explorer >= 8',
      'iOS >= 6',
      'Opera >= 12',
      'Safari >= 6'
    ], { cascade: true }))
    .pipe($.rename(pkg.name + '.css'))      // Rename to "packagename.css"
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

gulp.task('scripts', ['clean'], function () {
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
  gulp.src('public/img/**/*')               // Read images
    .pipe($.changed('./public/img'))        // Only process new/changed
    .pipe($.imagemin({
      optimizationLevel: 5,
      progressive: true,
      interlaced: true
    }))
    .pipe($.size({ title: 'Images:' }))    // What size are we at?
    .pipe(gulp.dest('./public/img'));      // Write processed images
});

/**
 * JSHint Files
 */

gulp.task('lint', function () {
  gulp.src(paths.lint)                      // Read .js files
    .pipe($.jshint())                       // Lint .js files
    .pipe($.jshint.reporter($.stylish))     // Specify a reporter for JSHint
    .pipe($.jshint.reporter($.fail));
});

/**
 * JSCS Files
 */

gulp.task('jscs', function () {
  // Monkey business to handle jscs errors without stopping gulp
  var j = $.jscs('./.jscsrc');
  j.on('error', function (e) {
    // $.util.log(e);
    j.end();
  });
  return gulp.src(paths.lint)
    .pipe(j);
});

/**
 * Build Task
 */

gulp.task('build', ['styles', 'scripts', 'images', 'lint', 'jscs']);

/**
 * Watch Files (Rerun/reload when a file changes)
 */

gulp.task('watch', function () {
  // Watch .less files, process/reload as needed
  gulp.watch(paths.less, ['styles']);
  // Watch client .js files, process/reload as needed
  gulp.watch(paths.js, ['scripts']);
  // Watch .js files, lint as needed
  gulp.watch(paths.lint, ['lint', 'jscs']);
  // Watch .jade files, reload as needed
  gulp.watch('views/**/*.jade').on('change', function (file) {
    $.livereload().changed(file.path);
  });
});

/**
 * Develop Task
 * (Depends on Watch Task)
 */

gulp.task('develop', ['watch'], function () {
  $.nodemon({ script: 'app.js', ext: 'js', ignore: ['gulpfile.js', 'public/', 'views/', 'less/', 'node_modules/'] })
    // .on('change', ['lint', 'jscs'])  // handled with watch task above
    .on('restart', function () {
      $.livereload();
    });
});

/**
 * Default Task
 * (depends on Build and Develop Tasks)
 */

gulp.task('default', ['build', 'develop']);

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
