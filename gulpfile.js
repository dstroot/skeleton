'use strict';

// Install: you must install gulp both globally *and* locally
// $ npm install -g gulp
// $ npm install gulp gulp-clean gulp-less gulp-nodemon gulp-jshint gulp-concat gulp-uglify gulp-rename gulp-autoprefixer gulp-imagemin gulp-cache gulp-size gulp-minify-css gulp-notify gulp-livereload --save-dev

/**
 * Dependencies
 */

var gulp          = require('gulp');
var clean         = require('gulp-clean');
var less          = require('gulp-less');
var nodemon       = require('gulp-nodemon');
var jshint        = require('gulp-jshint');
var concat        = require('gulp-concat');
var uglify        = require('gulp-uglify');
var rename        = require('gulp-rename');
var autoprefixer  = require('gulp-autoprefixer');
var imagemin      = require('gulp-imagemin');
var size          = require('gulp-size');
var jscs          = require('gulp-jscs');       // https://www.npmjs.org/package/jscs
var minifycss     = require('gulp-minify-css');
var notify        = require('gulp-notify');  // DOES NOT WORK ON WINDOWS
var livereload    = require('gulp-livereload');
var pkg           = require('./package.json');

/**
 * Paths
 */

var paths = {
  clean: [
    'public/js/**/' + pkg.name + '.js',
    'public/js/**/' + pkg.name + '.min.js',
    'public/css/**/' + pkg.name + '.css',
    'public/css/**/' + pkg.name + '.min.css'
  ],
  js: [
    'public/lib/jquery/dist/jquery.js',

    // Bootstrap
    'public/lib/bootstrap/js/transition.js',
    'public/lib/bootstrap/js/alert.js',
    'public/lib/bootstrap/js/button.js',
    // 'public/lib/bootstrap/js/carousel.js',
    'public/lib/bootstrap/js/collapse.js',
    'public/lib/bootstrap/js/dropdown.js',
    // 'public/lib/bootstrap/js/modal.js',
    // 'public/lib/bootstrap/js/tooltip.js',
    // 'public/lib/bootstrap/js/popover.js',
    // 'public/lib/bootstrap/js/scrollspy.js',
    // 'public/lib/bootstrap/js/tab.js',
    // 'public/lib/bootstrap/js/affix.js'

    // main project .js file
    'public/js/main.js'
  ],
  lint: [
    'config/**/*.js',
    '!config/secrets.js',
    'controllers/**/*.js',
    'models/**/*.js',
    'app.js',
    'app_cluster.js',
    'gulpfile.js'
  ],
  less: [
    'public/css/main.less',
    'public/css/bootstrap.less',
  ],
  images: 'public/img/**/*'
};

/**
 * Clean
 */

gulp.task('clean', function() {
  // Setting read to false will return file.contents as null and not read the file
  return gulp.src(paths.clean, {read: false})
    .pipe(clean())
    .pipe(notify({ message: 'Clean task complete!' }));
});

/**
 * Process CSS
 */

gulp.task('styles', function() {
  return gulp.src('./public/css/main.less')
    .pipe(less({}))                       // Compile Less files
    .pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
    .pipe(rename(pkg.name + '.css'))      // Rename to "packagename.css"
    .pipe(gulp.dest('./public/css'))      // Save CSS here
    .pipe(rename({suffix: '.min'}))       // Add .min suffix
    .pipe(minifycss())                    // Minify the CSS
    .pipe(size())                         // How did we do?
    .pipe(gulp.dest('./public/css'))      // Save minified CSS here
    .pipe(notify({ message: 'Styles task complete' }));
});

/**
 * JSHint Files
 */

gulp.task('lint', function() {
  gulp.src(paths.lint)                    // Read .js files
    .pipe(jshint('.jshintrc'))            // Lint .js files
    .pipe(jshint.reporter('default'))     // Specify a reporter for JSHint
    .pipe(jscs());
});

/**
 * Process Scripts
 */

gulp.task('scripts', function() {         // Scripts processing
  return gulp.src(paths.js)               // Read .js files
    .pipe(concat(pkg.name + '.js'))       // Concatenate .js files into "packagename.js"
    .pipe(gulp.dest('./public/js'))       // Save main.js here
    .pipe(rename({suffix: '.min'}))       // Add .min suffix
    .pipe(uglify())                       // Minify the .js
    .pipe(size())                         // How did we do?
    .pipe(gulp.dest('./public/js'))       // Save minified .js
    .pipe(notify({ message: 'Scripts task complete' }));
});

/**
 * Process Images
 */

gulp.task('images', function() {          // Image processing
  gulp.src(paths.images)                  // Read images
    .pipe(imagemin({ optimizationLevel: 5, progressive: true, interlaced: true }))
    .pipe(gulp.dest('./public/img'));     // Write processed images
});

/**
 * Build Task
 */

gulp.task('build', ['styles', 'scripts', 'images']);

/**
 * Watch Files (Rerun/reload when a file changes)
 */

gulp.task('watch', function () {
  var server = livereload();
  // Watch .less files, process/reload as needed
  gulp.watch(paths.less, ['styles'], function(evt) {
    server.changed(evt.path);
  });
  // Watch .js files, process/reload as needed
  gulp.watch(paths.js, ['scripts'], function(evt) {
    server.changed(evt.path);
  });
  // Watch .jade files, reload as needed
  gulp.watch('views/**/*.jade', function(evt) {
    server.changed(evt.path);
  });
});

/**
 * Develop Task
 * (Depends on Watch Task)
 */

gulp.task('develop', ['watch'], function () {
  nodemon({ script: 'app.js', options: '-e js -i ./public/js/**/*.js, ./gulpfile.js' });
});

/**
 * Default Task
 * (depends on Build and Develop Tasks)
 */

gulp.task('default', ['develop']);
