(function () {


  /*******************************
            onCreated
*******************************/

  handler = {
    regExp: {
      mobile: /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/g,
      tablet: /iPad/g,
    },

    get: {
      queryStringValue: function (key) {
        return decodeURIComponent(
          window.location.search.replace(
            new RegExp(
              '^(?:.*[&\\?]' +
                encodeURIComponent(key).replace(/[\.\+\*]/g, '\\$&') +
                '(?:\\=([^&]*))?)?.*$',
              'i'
            ),
            '$1'
          )
        );
      },
      section: function () {
        return $('body').attr('id');
      },
    },

    has: {
      webp: function () {
        var elem = document.createElement('canvas');
        if (elem.getContext && elem.getContext('2d')) {
          return elem.toDataURL('image/webp').indexOf('data:image/webp') == 0;
        } else {
          return false;
        }
      },
    },

    set: {
      loaded: function () {
        $('body').addClass('loaded');
      },
    },

    is: {
      ie11: function () {
        return !!window.MSInputMethodContext && !!document.documentMode;
      },
      tablet: function () {
        var userAgent = navigator.userAgent,
          isTablet = userAgent.match(handler.regExp.tablet);
        return isTablet ? true : false;
      },
      mobile: function () {
        var userAgent = navigator.userAgent,
          isTablet = userAgent.match(handler.regExp.tablet),
          isMobile = userAgent.match(handler.regExp.mobile);
        if (!isTablet && isMobile) {
          return true;
        } else {
          return false;
        }
      },
    },

    goto: {
      page: function (event) {
        var link = $(this).attr('data-href'),
          inLink = $(event.target).closest('a[href]').length > 0,
          hasTouch = 'ontouchstart' in document.documentElement;
        if (hasTouch || vac.isTablet || vac.isMobile || inLink) {
          return;
        }
        window.location.href = link;
      },
    },

    add: {
      masking: function () {
        $('input[data-mask]').each(function () {
          var maskName = $(this).data('mask');
          if (maskName) {
            vanillaTextMask.maskInput({
              inputElement: this,
              guide: false,
              mask: window.masks.getMask(maskName),
              placeholderChar: '\u2000',
            });
          }
        });
      },
    },

    precache: {
      images: function (images, callback, timeout) {
        if (!timeout) {
          timeout = 5000;
        }
        if (!$.isFunction(callback)) {
          callback = $.noop;
        }
        if (!$.isArray(images)) {
          images = [images];
        }
        var imagesLength = images.length,
          loadedCounter = 0,
          cache = [],
          cacheImage = document.createElement('img'),
          fired = false,
          handleLoad = function () {
            loadedCounter++;
            if (loadedCounter >= images.length) {
              if (!fired) {
                fired = true;
                callback();
              }
            }
          };
        handler.loadTimer = setTimeout(function () {
          if (!fired) {
            fired = true;
            callback();
          }
        }, timeout);
        while (imagesLength--) {
          cacheImage = document.createElement('img');
          cacheImage.onload = handleLoad;
          cacheImage.onerror = handleLoad;
          cacheImage.src = images[imagesLength];
          cache.push(cacheImage);
        }
      },
      imageSection: function (selector, callback, additionalImages) {
        var $images = $(selector),
          images = [];
        if (!$.isArray(additionalImages)) {
          additionalImages = [];
        }
        callback = callback || function () {};
        $images.each(function () {
          var src = this.currentSrc || this.src;
          if (src) {
            images.push(src);
          }
        });
        images = images.concat(additionalImages);
        handler.precache.images(images, callback);
      },
    },

    topbar: {
      height: 71,
      stick: function () {
      },
      unstick: function () {
      },
    },
  };

  /*******************************
          onRendered
*******************************/

  ready = function () {
    handler.set.loaded();

    // set webp
    if (handler.has.webp()) {
      vac.webp = true;
      $('body').addClass('webp');
    } else {
      $('body').addClass('no-webp');
      vac.webp = false;
    }

    vac.isMobile = handler.is.mobile();
    vac.isTablet = handler.is.tablet();
    vac.isIE11   = handler.is.ie11();

    /* Sticky Topbar */
    if ($('topBar').hasClass('dynamic')) {
      $('topBar').sticky({
        observeChanges: true,
        context: 'body',
        onStick: handler.topbar.stick,
        onUnstick: handler.topbar.unstick,
      });
    } else {
      $('topBar').sticky({
        observeChanges: true,
        context: 'body',
      });
    }

    /* Menu Dropdown */
    $('topBar .ui.dropdown').dropdown({
      on: 'hover',
      transition: 'drop',
      onShow: function () {
        $('platformPopup').addClass('below');
      },
      onHide: function () {
        $('platformPopup').removeClass('below');
      },
    });

    /* Add form masking */
    handler.add.masking();

    // make all div links work
    $('[data-href]').on('click', handler.goto.page);

  };

  /*******************************
        Attach Namespace
*******************************/

  window.vac[section] = {
    handler: handler,
    ready: ready,
  };
})();
