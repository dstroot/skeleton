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
var nodemon       = require('gulp-nodemon');       // https://www.npmjs.org/package/gulp-nodemon
var jshint        = require('gulp-jshint');
var concat        = require('gulp-concat');
var uglify        = require('gulp-uglify');
var rename        = require('gulp-rename');
var changed       = require('gulp-changed');       // https://github.com/sindresorhus/gulp-changed
var autoprefixer  = require('gulp-autoprefixer');
var imagemin      = require('gulp-imagemin');
var size          = require('gulp-size');
var jscs          = require('gulp-jscs');          // https://www.npmjs.org/package/jscs
var minifycss     = require('gulp-minify-css');
var notify        = require('gulp-notify');        // DOES NOT WORK ON WINDOWS
var livereload    = require('gulp-livereload');
var pkg           = require('./package.json');

/**
 * Paths
 */

var paths = {
  clean: [
    'public/js/**/*.js',
    'public/js/**/*.min.js',
    '!public/js/main.js',
    'public/css/**/*.css',
    'public/css/**/*.min.css'
  ],
  js: [
    'public/lib/jquery/dist/jquery.js',
    // Bootstrap ==============================
    // Enable/disable as needed ===============
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
    // =========================================
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
    'public/css/bootstrap.less'
  ],
  images: 'public/img/**/*'
};

/**
 * Clean
 */

gulp.task('clean', function() {
  gulp.src(paths.clean, {read: false})
    .pipe(clean())
    .pipe(notify({ onLast: true, message: 'Clean task complete' }));
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
    .pipe(livereload())                   // Initiate a reload
    .pipe(notify({ message: 'Styles task complete' }));
});

/**
 * JSHint Files
 */

gulp.task('lint', function() {
  gulp.src(paths.lint)                    // Read .js files
    .pipe(jshint('.jshintrc'))            // Lint .js files
    .pipe(jshint.reporter('default'))     // Specify a reporter for JSHint
    .pipe(jscs())                         // Check code style
    .pipe(notify({ onLast: true, message: 'Lint task complete' }));
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
    .pipe(livereload())                   // Initiate a reload
    .pipe(notify({ message: 'Scripts task complete' }));
});

/**
 * Process Images
 */

gulp.task('images', function() {          // Image processing
  gulp.src(paths.images)                  // Read images
    .pipe(changed('./public/img'))        // Only process new/changed
    .pipe(imagemin({ optimizationLevel: 5, progressive: true, interlaced: true }))
    .pipe(gulp.dest('./public/img'))      // Write processed images
    .pipe(notify({ onLast: true, message: 'Images task complete' }));
});

/**
 * Build Task
 */

gulp.task('build', ['clean', 'styles', 'scripts', 'images']);

/**
 * Watch Files (Rerun/reload when a file changes)
 */

gulp.task('watch', function () {

  // Watch .less files, process/reload as needed
  gulp.watch(paths.less, ['styles']);

  // Watch client .js files, process/reload as needed
  gulp.watch(paths.js, ['scripts']);

  // Watch .jade files, reload as needed
  gulp.watch('views/**/*.jade', function(evt) {
    livereload().changed(evt.path);
  });

});

/**
 * Develop Task
 * (Depends on Watch Task)
 */

gulp.task('develop', ['watch'], function () {
  nodemon({ script: 'app.js', options: '--debug --ignore gulpfile.js --ignore "public/js/*.js" --ignore "public/lib/**/*.js"' });
});

/**
 * Default Task
 * (depends on Build and Develop Tasks)
 */

gulp.task('default', [ 'build', 'develop']);
