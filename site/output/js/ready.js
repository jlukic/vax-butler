
/*******************************
        Global Dispatcher
*******************************/

$(document)
  .ready(function() {

    var
      section = vac.global.handler.get.section(),
      showModal = vac.global.handler.get.queryStringValue('showModal')
    ;

    // fire global ready
    vac.global.ready();

    // fire section on ready
    if(section && vac[section] !== undefined) {
      vac[section].ready();
    }

  })
;
