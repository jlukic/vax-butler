var
  gulp      = require('gulp'),
  watchUI   = require('./ui/tasks/watch'),
  buildUI   = require('./ui/tasks/build'),
  buildSite = require('./tasks/build'),
  watchSite = require('./tasks/watch')
;

// site specific
gulp.task('watch-site', watchSite);
gulp.task('build-site', buildSite);

// imported from SUI
gulp.task('watch-ui', watchUI);
gulp.task('build-ui', buildUI);

gulp.task('default', ['watch-ui', 'watch-site']);
gulp.task('build', ['build-ui', 'build-site']);
