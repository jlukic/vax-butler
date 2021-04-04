(function() {

  let
    // selector
    $ = function(query, context) {
      if(context) {
        return context.querySelectorAll(query);
      }
      let widget = document.querySelectorAll('.ui-widget');
      if(widget) {
        let lastWidget = widget[widget.length - 1];
        return lastWidget.querySelectorAll(query);
      }
      return document.querySelectorAll(query);
    },

    // shorthand
    selector,
    settings,
    tpl
  ;

  tpl = {

    reloadDelay: 10,

    startTime     : performance.now(),
    lastQueryTime : performance.now(),

    defaults: {
      zipcode  : 11222,
      borough  : 'Brooklyn',
      maxMiles : 3,
      minHour  : 0,
      maxHour  : 24
    },

    selector: {
      searchInput : 'input[name="zipCodeValue',
      loader      : '.loader-modal',
      noResults   : '.appointment-section .help_text--red',
      appointment : '.appointment_card',
      patientInfo : 'c-vcms-patient-information-section-a',
      miles       : '.slds-m-bottom_none',
      time        : 'lightning-formatted-time',
      name        : '.page-h3',
      nextButton  : '.slds-button.slds-button_brand',
    },

    results: [],

    settings: {},

    initialize() {
      tpl.set.userSettings();
      tpl.set.shorthand();

      tpl.bind.documentObserver();
      tpl.set.zipcodeQuery();

      tpl.interval = setInterval(function() {
        tpl.set.zipcodeQuery();
        setTimeout(tpl.event.documentChanged, 1000);
      }, 2000);

    },

    destroy() {
      tpl.observer.disconnect();
    },

    bind: {
      // add observermutation observer for determining when appointment is found
      documentObserver() {
        window.observer = new MutationObserver(tpl.event.documentChanged);
        observer.observe(document, {
          childList: true,
          subtree: true,
        });
      }
    },

    get: {

      appointmentList() {
        let
          appointmentEls = $(selector.appointment),
          appointments   = []
        ;
        for (let appointmentEl of appointmentEls) {
          let
            isMatch       = true,
            nameEl        = $(selector.name, appointmentEl)[0],
            milesEl       = $(selector.miles, appointmentEl)[0],
            timeEls       = $(selector.time, appointmentEl),
            addressEl     = milesEl.parentNode,

            name          = nameEl.innerText,
            address       = addressEl.innerText.split('|')[0].trim(),
            milesString   = milesEl.innerHTML.replace(/(\||[a-z]|\s)+/mg, ''),
            miles         = parseFloat(milesString, 10),
            times         = [],
            matchingTimes = [],
            addressParts  = address.split(','),
            borough       = addressParts[addressParts.length - 2].trim(),
            appointmentData
          ;

          // check constraints
          if(typeof settings.borough == 'string' && settings.borough !== 'any' && borough.toLowerCase() != settings.borough.toLowerCase()) {
            isMatch = false;
          }
          if(typeof settings.maxMiles == 'number' && miles > settings.maxMiles) {
            isMatch = false;
          }
          for (let timeEl of timeEls) {
            let
              timeText  = timeEl.innerText,
              timeParts = timeText.split(' '),
              hourParts = timeParts[0].split(':'),
              time      = {
                hours   : parseInt(hourParts[0], 10),
                minutes : parseInt(hourParts[1], 10),
                element : timeEl,
              }
            ;
            if(timeParts[1] == 'PM') {
              time.hours += 12;
            }
            if(isMatch && time.hours > settings.minHour && time.hours < settings.maxHour) {
              matchingTimes.push(time);
            }
            times.push(time);
          }

          if(matchingTimes.length == 0) {
            isMatch = false;
          }

          appointmentData = {
            name          : name,
            miles         : miles,
            address       : address,
            times         : times,
            matchingTimes : matchingTimes,
            isMatch       : isMatch
          };
          appointments.push(appointmentData);
        }
        return appointments;
      },

      randomElement(arrayItems) {
        return arrayItems[Math.floor(Math.random() * arrayItems.length)];
      },

    },

    set: {
      shorthand() {
        settings = tpl.settings;
        selector = tpl.selector;
      },
      userSettings() {
        /*
        let
          borough  = window.prompt('Please enter your borough or leave as "Any" if no preference', 'Any'),
          maxMiles = window.prompt('Please enter maximum miles you are willing to travel', 100),
          minHour  = window.prompt('Please enter minimum hour for appointment (24 hour time)', 0),
          maxHour  = window.prompt('Please enter latest hour for appointment (24 hour time)', 24)
        ;
        Object.assign(tpl.settings, tpl.defaults, {
          borough  : borough,
          maxMiles : maxMiles,
          minHour  : minHour,
          maxHour  : maxHour,
        });
        */
        tpl.settings = tpl.defaults;

      },
      zipcodeQuery() {
        tpl.lastQueryTime = performance.now();
        let searchEl = $(selector.searchInput)[0];
        if(searchEl) {
          searchEl.value = null;
          searchEl.value = settings.zipcode;
        }
      },
    },

    select: {
      appointmentTime(timeEl) {
        if(!timeEl) {
          return;
        }
        timeEl.click();
        $(selector.nextButton)[0].click();
      }
    },

    show: {
      settingsModal() {

      },
      successModal() {
      }
    },

    event: {
      documentChanged(mutations) {

        // results are loading still
        if($(selector.loader).length > 0) {
          console.log('a) loader');
          return;
        }

        // no results found
        if($(selector.noResults).length > 0) {
          console.log('b) no results');
          tpl.results.push({
            completed     : new Date(),
            executionTime : performance.now() - tpl.lastQueryTime,
            appointments  : []
          });
          setTimeout(tpl.set.zipcodeQuery, tpl.reloadDelay);
          return;
        }

        // check if new page content is in the DOM
        if($(selector.appointment).length > 0) {
          let
            appointments = tpl.get.appointmentList(),
            hasMatching  = false
          ;
          console.log('c) new apt list found', appointments);
          tpl.results.push({
            completed     : new Date(),
            executionTime : performance.now() - tpl.lastQueryTime,
            appointments  : appointments
          });
          // select first matching appointment
          for(let index=0; index < appointments.length; index++) {
            let appointment = appointments[index];
            console.log(appointment);
            if(appointment.matchingTimes.length) {
              let time = tpl.get.randomElement(appointment.matchingTimes);
              tpl.select.appointmentTime(time.element);
              hasMatching = true;
              return;
            }
          }
          console.log('again?', hasMatching);
          setTimeout(tpl.set.zipcodeQuery, tpl.reloadDelay);
        }

        if($(selector.patientInfo).length > 0) {
          console.log('d) appointment selected');
          tpl.show.successModal();
          return;
        }
        console.log('d', mutations);
      }
    },


  };

  tpl.initialize();

  window.butler = tpl;

})();
