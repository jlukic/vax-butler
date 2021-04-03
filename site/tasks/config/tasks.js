module.exports = {
  log: {
    created: function(file) {
      return 'Created: ' + file;
    },
    test: function() {
      return 'Got here!';
    },
    modified: function(file) {
      return 'Modified: ' + file;
    }
  },

  /* What Browsers to Prefix */
  prefix: {
    browsers: [
      'last 2 versions',
      '> 1%',
      'Safari 9',
      'Opera 12.1',
      'bb 10',
      'Android 4'
    ]
  },

  nano: {
    safe: true
  },

  /* File Renames */
  rename: {
    minJS     : { extname : '.min.js' },
    minCSS    : { extname : '.min.css' },
    rtlCSS    : { extname : '.rtl.css' },
    rtlMinCSS : { extname : '.rtl.min.css' }
  },

  /* Minified CSS Concat */
  minify: {
    processImport       : false,
    restructuring       : false,
    keepSpecialComments : 1
  },

  /* Minified JS Settings */
  uglify: {
    mangle : true,
    //preserveComments : 'some'
  }
};
