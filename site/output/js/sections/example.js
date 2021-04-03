(function() {

  var
    section = 'example',
    handler,
    ready
  ;

  /*******************************
              onCreated
  *******************************/

  handler = {




  };

  /*******************************
             onRendered
  *******************************/

  ready = function() {

    // Attach to global namespace
    window.vac[section] = {
      handler : handler,
      ready   : ready
    };

  };

}());

