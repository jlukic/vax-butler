module.exports = {
  css: {
    watch: ['input/files/js/global.css', 'input/files/css/**/*.css'],
    compile: [
      'input/files/css/global.css',
      'input/files/css/sections/**/*.css',
      'input/files/css/ribbons/**/*.css',
      'input/files/css/experiments/**/*.css',
      'input/files/css/browsers/**/*.css',
      'input/files/css/devices/**/*.css',
    ],
    output: {
      name: 'site.css',
      minifiedName: 'site.min.css',
      folder: 'input/files/dist/',
      staticFolder: 'output/files/dist',
    },
  },
  js: {
    watch: ['input/files/js/global.js', 'input/files/js/!(library)/**/*.js'],
    compile: [
      'input/files/js/config.js',
      'input/files/js/global.js',
      'input/files/js/sections/**/*.js',
      'input/files/js/ribbons/**/*.js',
      'input/files/js/experiments/**/*.js',
      'input/files/js/ready.js',
    ],
    output: {
      name: 'site.js',
      minifiedName: 'site.min.js',
      folder: 'input/files/dist/',
    },
  },
  lib: {
    watch: ['input/files/js/library/*.js'],
    compile: ['input/files/js/library/**/*.js'],
    output: {
      name: 'libraries.js',
      minifiedName: 'libraries.min.js',
      folder: 'input/files/dist/',
    },
  },
};
