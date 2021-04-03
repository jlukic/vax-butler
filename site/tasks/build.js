/*******************************
           Build Task
*******************************/

var
  // compile
  gulp         = require('gulp'),
  plumber      = require('gulp-plumber'),
  print        = require('gulp-print').default,
  debug        = require('gulp-debug'),
  // both
  sourcemaps   = require('gulp-sourcemaps'),
  // css
  autoprefixer = require('gulp-autoprefixer'),
  concat       = require('gulp-concat'),
  cssnano      = require('gulp-cssnano'),
  postcss      = require('gulp-postcss'),
  cssvariables = require('postcss-css-variables'),
  // js
  uglify       = require('gulp-uglify'),
  // config
  taskSettings = require('./config/tasks'),
  paths        = require('./config/paths')
;

module.exports = function (callback) {

  /*--------------
      Build CSS
  ---------------*/

  gulp
    .src(paths.css.compile, { base: '.' })
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(autoprefixer(taskSettings.prefix))
    .pipe(postcss([cssvariables()]))
    .pipe(cssnano(taskSettings.nano))
    .pipe(concat(paths.css.output.minifiedName))
    .pipe(sourcemaps.write('maps/'))
    .pipe(gulp.dest(paths.css.output.folder))
    .pipe(debug())
    .pipe(print(taskSettings.log.created));

  /*--------------
      Build JS
  ---------------*/

  gulp
    .src(paths.js.compile, { base: '.' })
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(uglify(taskSettings.uglify))
    .pipe(concat(paths.js.output.minifiedName))
    .pipe(sourcemaps.write('maps/'))
    .pipe(gulp.dest(paths.js.output.folder))
    .pipe(print(taskSettings.log.created));

  /*--------------
     Library JS
  ---------------*/

  gulp
    .src(paths.lib.compile, { base: '.' })
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(uglify(taskSettings.uglify))
    .pipe(concat(paths.lib.output.minifiedName))
    .pipe(sourcemaps.write('maps/'))
    .pipe(gulp.dest(paths.lib.output.folder))
    .pipe(print(taskSettings.log.created));
};
