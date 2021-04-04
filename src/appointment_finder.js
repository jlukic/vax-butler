(function() {

  let
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
    settings
  ;

  tpl = {

    reloadTime: 100,

    defaults: {
      borough  : 'any',
      maxMiles : 999,
      minHour  : 0,
      maxHour  : 24
    },

    selector: {
      searchInput : 'input[name="zipCodeValue',
      appointment : '.appointment_card',
      patientInfo : 'c-vcms-patient-information-section-a',
      miles       : '.slds-m-bottom_none',
      time        : '.lightning-formatted-time',
      name        : '.page-h3'
    },

    settings: {},

    initialize() {
      tpl.set.userSettings();
      tpl.set.shorthand();

      tpl.bind.documentObserver();
      tpl.start.searchLoop();
    },

    start: {
      searchLoop() {
        tpl.searchLoop = setInterval(tpl.set.zipcodeQuery, tpl.reloadTime);
      }
    },

    bind: {
      documentObserver() {
        // add mutation observer for determining when appointment is found
        let selectObserver = new MutationObserver(tpl.event.documentChanged);
        documentObserver.observe(document, {
          childList : true,
          subtree   : true
        });
      }
    },

    set: {
      shortHand() {
        settings = tpl.settings;
        selector = tpl.selector;
      },
      userSettings(userSettings) {
        settings = Object.assign(defaults, userSettings);
      },
      zipcodeQuery() {
        $(selector.searchInput).value = null;
        $(selector.searchInput).value = settings.zipcode;
      },
      appointmentList() {
        // each loop on blocks
        let appointments = $(appointment);
        for (let appointment of appointments) {
          console.log(appointment);
          let
            isMatch       = true,
            nameEl        = $(selector.name, appointment)[0],
            milesEl       = $(selector.miles, appointment)[0],
            timeEls       = $(selector.time, appointment),
            addressEl     = milesEl.parentNode,

            name          = nameEl.innerText,
            address       = addressEl.innerText.split('|')[0].trim(),
            milesString   = milesEl.innerHTML.replace(/(\||[a-z]|\s)+/mg, ''),
            miles         = parseFloat(milesString, 10),
            times         = [],
            matchingTimes = [],
            appointmentData,
            borough
          ;

          for (let timeEl of timeEls) {
            let
              timeText  = timeEl.innerText,
              timeParts = timeText.split(' '),
              hourParts = timeParts[0].split(':'),
              time      = {
                hours   : Number(hourParts[0]),
                minutes : Number(hourParts[1]),
                element : timeEl,
              }
            ;
            if(timeParts[1] == 'PM') {
              time.hours += 12;
            }
            if(hour > settings.minHour && hour < settings.maxHour) {
              matchingTimes.push(time);
            }
            times.push(time);
          }
          appointmentData = {
            name          : name,
            miles         : miles,
            address       : address,
            times         : times,
            matchingTimes : matchingTimes,
          };
          appointments.push(appointmentData);
        }
      },
    },

    select: {
      appointment() {



        console.log(address, miles);

        // check if matches mile constraint

        // check if matches borough constraint

        // get each time choice

        // iterate over each time

        // push ones that match time constraints to matching time list

        // store first matching el

        // store info to obj with isMatch

        // filter list by match

        // click first


      }
    },

    show: {
      settingsModal() {

      },
      successModal() {
        // show confetti overlay with the time and place

      }
    },

    event: {
      documentChanged() {

        // check if new page content is in the DOM
        if($(selector.appointment).length > 0) {
          tpl.set.appointmentList();
          return;
        }

        if($(selector.patientInfo).length > 0) {
          showSuccessModal();
        }
      }
    },


  }.initialize();



})();
