'use strict';

// Install: you must install gulp both globally *and* locally.
// $ npm install -g gulp
// $ npm install gulp gulp-clean gulp-less gulp-nodemon gulp-jshint gulp-concat gulp-uglify gulp-rename gulp-autoprefixer gulp-imagemin gulp-cache gulp-size gulp-minify-css gulp-notify gulp-livereload --save-dev

/**
 * Dependencies
 */

var gulp          = require('gulp');
var size          = require('gulp-size');
var jscs          = require('gulp-jscs');          // https://www.npmjs.org/package/jscs
var less          = require('gulp-less');
var clean         = require('gulp-clean');
var concat        = require('gulp-concat');
var header        = require('gulp-header');
var uglify        = require('gulp-uglify');
var notify        = require('gulp-notify');        // DOES NOT WORK ON WINDOWS
var rename        = require('gulp-rename');
var jshint        = require('gulp-jshint');        // https://github.com/wearefractal/gulp-jshint
var stylish       = require('jshint-stylish');
var changed       = require('gulp-changed');       // https://github.com/sindresorhus/gulp-changed
var nodemon       = require('gulp-nodemon');       // https://www.npmjs.org/package/gulp-nodemon
var imagemin      = require('gulp-imagemin');
var minifycss     = require('gulp-minify-css');    // https://www.npmjs.org/package/gulp-minify-css
var livereload    = require('gulp-livereload');
var autoprefixer  = require('gulp-autoprefixer');

/**
 * Banner
 */

var pkg = require('./package.json');
var banner = ['/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version v<%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @license <%= pkg.license %>',
  ' */',
  ''].join('\n');

/**
 * Paths
 */

var paths = {
  clean: [
    '!public/js/main.js',
    'public/js/**/*.js',
    'public/js/**/*.min.js',
    'public/css/**/*.css',
    'public/css/**/*.min.css'
  ],
  js: [
    // Bootstrap  ==============================
    // Enable/disable as needed but
    // only turn on .js that is needed
    // on *every* page. No bloat!
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
    '!config/secrets.js',
    'test/**/*.js',
    'controllers/**/*.js',
    'models/**/*.js',
    'app.js',
    'app_cluster.js',
    'gulpfile.js'
  ]
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
  return gulp.src('./less/main.less')
    .pipe(less({}))                       // Compile Less files
    .pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
    .pipe(rename(pkg.name + '.css'))      // Rename to "packagename.css"
    .pipe(gulp.dest('./public/css'))      // Save CSS here
    .pipe(rename({suffix: '.min'}))       // Add .min suffix
    .pipe(minifycss({ keepSpecialComments: 0, removeEmpty: true }))
    .pipe(header(banner, { pkg : pkg } )) // Add banner
    .pipe(size())                         // What size are we at?
    .pipe(gulp.dest('./public/css'))      // Save minified CSS here
    .pipe(livereload())                   // Initiate a reload
    .pipe(notify({ message: 'Styles task complete' }));
});

/**
 * JSHint Files
 */

gulp.task('lint', function() {
  gulp.src(paths.lint)                    // Read .js files
    .pipe(jshint())                       // Lint .js files
    .pipe(jshint.reporter(stylish))       // Specify a reporter for JSHint
    .pipe(jscs())                         // Check code style
    .pipe(notify({ onLast: true, message: 'Lint task complete' }));
});

/**
 * Process Scripts
 */

gulp.task('scripts', function() {
  return gulp.src(paths.js)               // Read .js files
    .pipe(concat(pkg.name + '.js'))       // Concatenate .js files into "packagename.js"
    .pipe(gulp.dest('./public/js'))       // Save main.js here
    .pipe(rename({suffix: '.min'}))       // Add .min suffix
    .pipe(uglify({ outSourceMap: true })) // Minify the .js
    .pipe(header(banner, { pkg : pkg } )) // Add banner
    .pipe(size())                         // What size are we at?
    .pipe(gulp.dest('./public/js'))       // Save minified .js
    .pipe(livereload())                   // Initiate a reload
    .pipe(notify({ onLast: true, message: 'Scripts task complete' }));
});

/**
 * Process Images
 */

gulp.task('images', function() {
  gulp.src('public/img/**/*')             // Read images
    .pipe(changed('public/img/**/*'))     // Only process new/changed
    .pipe(imagemin({ optimizationLevel: 5, progressive: true, interlaced: true }))
    .pipe(gulp.dest('./public/img'))      // Write processed images
    .pipe(notify({ onLast: true, message: 'Images task complete' }));
});

/**
 * Build Task
 */

gulp.task('build', ['clean', 'styles', 'scripts', 'images', 'lint']);

/**
 * Watch Files (Rerun/reload when a file changes)
 */

gulp.task('watch', function () {

  // Watch .less files, process/reload as needed
  gulp.watch('less/**/*.less', ['styles']);

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
  // nodemon({ script: 'app.js', ext: 'js', ignore: ['gulpfile.js', 'public/'], verbose: 'true' })
  nodemon({ script: 'app.js' })
    .on('restart', ['lint']);
});

/**
 * Default Task
 * (depends on Build and Develop Tasks)
 */

gulp.task('default', [ 'build', 'develop']);
