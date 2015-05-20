var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var livereload = require('gulp-livereload');
var stringify = require('stringify');

// dev: source maps, debug
gulp.task('dev', function () {
  return browserify(__dirname + '/app.js', { debug: true })
    .transform(babelify.configure())
    .transform(stringify(['.txt', '.html', '.css']))
    .bundle()
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(gulp.dest(__dirname + '/dist'))
    .pipe(livereload());
});

// prd: uglified
gulp.task('prod', function () {
  return browserify(__dirname + '/app.js')
    .transform(babelify)
    .transform(stringify(['.txt', '.html', '.css']))
    .bundle()
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest(__dirname + '/dist'))
});
