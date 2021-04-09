/*!
 * # Vaccine Butler (1.0.0)
 * http://github.com/jlukic/vax-butler
 *
 *
 * Released under the MIT license
 * http://opensource.org/licenses/MIT
 *
 */

(function() {

  // allow error reporting in console
  window.onerror = null;

  let

    // template code defined at bottom
    settingsModal,
    completedModal,
    searchOverlay,
    errorModal,

    // this is set to injected dom context
    domContext,

    html,
    css,

    // json of locations (loaded at end of file)
    locations,

    // shorthand
    selector,
    settings,

    // selector on external dom
    $ = function(query, context) {
      if(context) {
        return context.querySelectorAll(query);
      }
      let widget = document.querySelectorAll('.ui-widget');
      if(widget.length) {
        let lastWidget = widget[widget.length - 1];
        return lastWidget.querySelectorAll(query);
      }
      return document.querySelectorAll(query);
    },

    // selector on internal dom
    $$ = function(query) {
      return $(query, domContext);
    },

    clone = function(obj) {
      return Object.assign({}, obj);
    },

    tpl
  ;


  tpl = {

    version             : '1.0.0',

    // required URL to run script
    runDomain           : 'vax4nyc.nyc.gov',

    // whether to log behavior to console
    debug               : true,


    // for tracking metrics
    startTime           : false,
    completedTime       : false,
    lastQueryTime       : false,

    // whether to use interval or mutation observers
    // Note: mutation observers are currently not firing properly
    // most likely due to intererence from LockerService
    // <https://developer.salesforce.com/blogs/developer-relations/2016/04/introducing-lockerservice-lightning-components.html>
    useInterval         : true,

    // percent of interval to adjust timing to add jitter
    jitterRatio         : 0.2,

    // maximum edit distance for location to be considered same
    maxEditDistance     : 0,

    // internal state during search
    selectedAppointment : false,
    selectedTime        : false,
    results             : [],

    // record if the button last clicked caused an error
    // to avoid rapidly retrying it
    failedTime          : false,

    // confetti animation
    confettiAnimationFrame: false,
    confettiColors: [
      [255, 207, 207], // pink
      [31, 41, 112], // purple
      [13, 80, 171], // blue
      [177, 227, 241], // light blue
      [255, 255, 255] // white
    ],

    // minimum permissable search interval
    minSearchInterval: 10,

    // frequency to update stats
    updateStatsInterval: 1000,

    defaults: {
      // frequency of search in seconds
      searchInterval : 35,

      // seconds after query to check results
      checkDelay     : 1,

      zipcode        : 11222,
      borough        : 'Brooklyn',
      maxMiles       : 30,
      minHour        : 0,
      maxHour        : 24,
      vaccines       : ['Moderna', 'Pfizer', 'Johnson & Johnson'],
    },
    settings: {},

    selector: {
      dateInput        : 'input[name="scheduleDate',
      searchInput      : 'input[name="zipCodeValue',
      loader           : '.loader-modal',
      noResults        : '.appointment-section .help_text--red',
      appointment      : '.appointment_card',
      patientInfo      : 'c-vcms-patient-information-section-a',
      miles            : '.slds-m-bottom_none',
      time             : 'lightning-formatted-time',
      name             : '.page-h3',
      nextButton       : '.btn-section .slds-button.slds-button_brand',
      previousButton   : '.btn-section .slds-button_outline-brand',
      errorModal       : '.slds-modal .help_text--red',
      errorModalButton : '.slds-modal .slds-button_brand'
    },


    initialize() {


      if(window.butler) {
        window.butler.destroy();
      }

      tpl.setup.styles();
      tpl.setup.html();
      tpl.setup.events();

      if(tpl.check.wrongDomain()) {
        return;
      }

      tpl.show.settingsModal();

    },
    start(settings = tpl.defaults) {

      tpl.clear.search();

      tpl.startTime = new Date();

      // update overlay text
      tpl.set.searchOverlayText();
      tpl.overlayInterval = setInterval(tpl.set.searchOverlayText, tpl.updateStatsInterval);

      // NOTE
      // it appears something is preventing MutationObservers from reporting (maybe Recaptcha)
      // A more brutish method with interval is necessary to handle refresh
      if(tpl.useInterval) {
        tpl.search();
      }
      else {
        tpl.set.appointmentQuery();
        tpl.bind.documentObserver();
      }

      tpl.show.searchOverlay();
    },

    search() {
      tpl.set.appointmentQuery();
      clearTimeout(tpl.checkTimer);
      tpl.checkTimer = setTimeout(function() {
        tpl.event.documentChanged();
      }, tpl.get.checkDelay());
    },

    searchAgain() {
      tpl.searchTimer = setTimeout(tpl.search, tpl.get.searchInterval());
    },

    stop() {
      if(tpl.observer) {
        tpl.observer.disconnect();
      }
      if(tpl.searchTimer) {
        clearTimeout(tpl.searchTimer);
      }
      if(tpl.checkTimer) {
        clearTimeout(tpl.checkTimer);
      }
      if(tpl.overlayInterval) {
        clearInterval(tpl.overlayInterval);
      }
    },

    destroy() {
      tpl.log('Tearing down butler');
      tpl.stop();
      tpl.teardown.domElements();
    },

    log(a, b, c, d) {
      if(!tpl.debug) {
        return;
      }
      if(d) {
        console.log(a, b, c, d);
      }
      else if(c) {
        console.log(a, b, c);
      }
      else if(b) {
        console.log(a, b);
      }
      else if(a) {
        console.log(a);
      }
    },

    // add observermutation observer for determining when state change occurs
    bind: {
      documentObserver() {
        window.observer = new MutationObserver(tpl.event.documentChanged);
        observer.observe(document, {
          childList: true,
          subtree: true,
        });
      }
    },

    check: {
      wrongDomain() {
        let
          href = window.location.href
        ;
        if(href.search('file://') == -1) {
          //return false;
        }
        if(href.search(tpl.runDomain) == -1) {
          tpl.show.errorModal();
          return true;
        }
        return false;
      }
    },

    // handle inserting custom html/css into site
    setup: {
      html() {
        if(!document.querySelectorAll('contentInject').length) {
          document.body.insertAdjacentElement('beforeend', document.createElement('contentInject'));
        }
        // add all content
        let
          injectEl = document.querySelectorAll('contentInject')[0]
        ;
        injectEl.innerHTML = html;

        // setup reference to dom context
        domContext = injectEl;
      },
      styles() {
        if(!document.querySelectorAll('styleInject').length) {
          document.body.insertAdjacentElement('beforeend', document.createElement('styleInject'));
        }
        let
          injectEl = document.querySelectorAll('styleInject')[0],
          styleEl = document.createElement('style')
        ;
        injectEl.innerHTML = `<style>${css}</style>`;
      },
      events() {
        let
          settingsSubmitEl  = $$('settingsModal submit.button')[0],
          settingsCancelEl  = $$('settingsModal cancel.button')[0],
          overlayModifyEl   = $$('overlay a.modify')[0],
          overlayCancelEl   = $$('overlay a.cancel')[0],
          completedSubmitEl = $$('completedModal submit.button')[0],
          completedCancelEl = $$('completedModal cancel.button')[0],
          completedNewEl    = $$('completedModal new.button')[0],
          errorCancelEl     = $$('errorModal cancel.button')[0]
        ;

        settingsSubmitEl.addEventListener('click', tpl.event.submitSettingsClick);
        settingsCancelEl.addEventListener('click', tpl.event.cancelSettingsClick);

        overlayModifyEl.addEventListener('click', tpl.event.modifyOverlayClick);
        overlayCancelEl.addEventListener('click', tpl.event.cancelOverlayClick);

        completedSubmitEl.addEventListener('click', tpl.event.completedSubmitClick);
        completedCancelEl.addEventListener('click', tpl.event.completedCancelClick);
        completedNewEl.addEventListener('click', tpl.event.completedNewClick);

        errorCancelEl.addEventListener('click', tpl.event.errorCancelEl);

      },
    },

    teardown: {
      domElements() {
        let contentEl = document.querySelectorAll('contentInject')[0];
        if(contentEl) {
          contentEl.remove();
        }
        let styleEl = document.querySelectorAll('styleInject')[0];
        if(styleEl) {
          styleEl.remove();
        }
      }
    },

    get: {

      unique(arr) {
        return arr.filter((value, index, self) => self.indexOf(value) === index);
      },

      searchInterval() {
        return (settings.searchInterval * 1000) + tpl.get.jitter();
      },

      checkDelay() {
        return (settings.checkDelay * 1000) + tpl.get.jitter();
      },

      // add random jitter to requests times
      jitter() {
        return (Math.random() * tpl.jitterRatio);
      },

      searchDate() {
        let
          dateEl = $(selector.dateInput)[0]
        ;
        if(!dateEl) {
          return;
        }
        return dateEl.value;
      },

      // format required for nyc date input
      displayDate(date) {
        if(!date) {
          date = new Date();
        }
        let
          dd   = String(date.getDate()),
          mm   = String(date.getMonth() + 1),
          yyyy = date.getFullYear()
        ;
        return `${mm}/${dd}/${yyyy}`;
      },

      locationInfo(location) {
        let match;
        if(typeof location !== 'object') {
          return;
        }
        if(location.address) {
          match = tpl.get.location(location.address);
        }
        if(!match && location.name) {
          match = tpl.get.location(location.name);
        }
        return match;
      },

      phone(location) {
        let
          match = tpl.get.locationInfo(location)
        ;
        if(match && match.phone) {
          return match.phone;
        }
        return;
      },

      vaccines(location) {
        let
          match = tpl.get.locationInfo(location)
        ;
        if(match && match.vaccines) {
          return match.vaccines;
        }
        return;
      },

      // from <https://gist.github.com/andrei-m/982927>
      // some data has minor typos due to data entry errors
      // we allow for some minor defects for matching locations
      // For example this error from testing:
      // 127 Pennsylvania Avenue, Brooklyn, 11027
      // 127 Pennsylvania Avenue, Brooklyn, NY 11207
      levenshteinDistance(a, b){
        if(a.length == 0) return b.length;
        if(b.length == 0) return a.length;

        let matrix = [];

        // increment along the first column of each row
        let i;
        for(i = 0; i <= b.length; i++){
          matrix[i] = [i];
        }

        // increment each column in the first row
        let j;
        for(j = 0; j <= a.length; j++){
          matrix[0][j] = j;
        }

        // Fill in the rest of the matrix
        for(i = 1; i <= b.length; i++){
          for(j = 1; j <= a.length; j++){
            if(b.charAt(i-1) == a.charAt(j-1)){
              matrix[i][j] = matrix[i-1][j-1];
            } else {
              matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                      Math.min(matrix[i][j-1] + 1, // insertion
                                               matrix[i-1][j] + 1)); // deletion
            }
          }
        }

        return matrix[b.length][a.length];
      },

      locations() {
        return locations;
      },

      location(query) {
        let
          locations = tpl.get.locations(),
          isSame = (a, b) => {
            a = a.trim();
            b = b.trim();
            if(tpl.maxEditDistance == 0) {
              return a == b;
            }
            let editDistance = tpl.get.levenshteinDistance(a, b);
            if(editDistance <= tpl.maxEditDistance) {
              tpl.log('match found', editDistance, a, b);
              return true;
            }
            return false;
          },
          place,
          location
        ;

        for(let index = 0; index < locations.length; index++) {
          place = locations[index];


          if(isSame(place.name, query)) {
            location = place;
            break;
          }

          // Some addresses have a "The" before like
          // The Community Center vs.
          // Community Center
          let
            theLessQuery = query.replace(/^the/ig, ''),
            theLessName = place.name.replace(/^the/ig, '')
          ;
          if(isSame(theLessName, theLessQuery)) {
            location = place;
            break;
          }

          // some addresses omit ny state
          // i.e. '55 Richmond Terrace, Staten Island, 10301' != '55 Richmond Terrace, Staten Island, NY 10301'
          let
            statelessQuery   = (query || '').replace(' NY', ''),
            statelessAddress = (place.address || '').replace(' NY', '')
          ;
          if(isSame(place.address, query) || isSame(statelessAddress, statelessQuery)) {
            location = place;
            break;
          }
        }
        if(!location) {
          return;
        }
        return clone(location);
      },

      htmlAddress(address) {
        let
          addressParts = address.split(','),
          partIndex = addressParts.length - 1,
          partCount = 1,
          addressHTML = ''
        ;
        for(let index = 0; index < addressParts.length; index++) {
          let text = addressParts[index];
          if(index == addressParts.length - 2) {
            addressHTML += '<br>';
            addressHTML += text.trim();
          }
          else if(index == 0) {
            addressHTML += text;
          }
          else {
            addressHTML += `,${text}`;
          }
        }
        return addressHTML;
      },

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

            name          = nameEl.innerText.trim(),
            address       = addressEl.innerText.split('|')[0].trim(),
            milesString   = milesEl.innerHTML.replace(/(\||[a-z]|\s)+/mg, ''),
            miles         = parseFloat(milesString, 10),
            times         = [],
            matchingTimes = [],
            addressParts  = address.split(','),
            borough       = addressParts[addressParts.length - 2].trim(),
            locationInfo  = tpl.get.locationInfo({
              name    : name,
              address : address
            }),

            vaccines,
            phone,
            appointmentData
          ;

          // pluck out data from location info JSON
          if(locationInfo) {
            if(locationInfo.vaccines) {
              vaccines = locationInfo.vaccines;
            }
            if(locationInfo.phone) {
              phone = locationInfo.phone;
            }
          }

          // borough constraint
          if(typeof settings.borough == 'string' && settings.borough !== 'Any' && borough.toLowerCase() != settings.borough.toLowerCase()) {
            isMatch = false;
            tpl.log('incorrect borough', name, borough);
          }

          // mile constraint
          if(typeof settings.maxMiles == 'number' && miles > settings.maxMiles) {
            tpl.log('exceeds max miles', name, miles);
            isMatch = false;
          }

          // vaccine constraint (if not all vaccines)
          if(settings.vaccines.length < tpl.defaults.vaccines.length) {
            if(vaccines) {
              let
                matchingVaccines = vaccines.filter(vaccine => settings.vaccines.includes(vaccine))
              ;
              if(matchingVaccines.length == 0) {
                isMatch = false;
                tpl.log('requested vaccine not offered', tpl.get.vaccineText(vaccines), settings.vaccines);
              }
            }
            else {
              tpl.log('no vaccine list scraped', name, settings.vaccines);
              isMatch = false;
            }
          }

          // time constraint
          for (let timeEl of timeEls) {
            let
              timeText  = timeEl.innerText,
              timeParts = timeText.split(' '),
              hourParts = timeParts[0].split(':'),
              time      = {
                text    : timeText,
                hours   : parseInt(hourParts[0], 10),
                minutes : parseInt(hourParts[1], 10),
                element : timeEl,
              }
            ;
            if(timeParts[1] == 'PM') {
              time.hours += 12;
            }
            if(time.hours > settings.minHour && time.hours < settings.maxHour) {
              if(isMatch) {
                // filter out last failed appointment to avoid reselecting it
                if(tpl.failedTime && tpl.failedTime.element == time.element) {
                  tpl.log('Ignoring reselecting failed appointment');
                }
                else {
                  matchingTimes.push(time);
                }
              }
            }
            else {
              tpl.log('Appointment time outside range', name, timeText);
            }
            times.push(time);
          }


          if(matchingTimes.length == 0) {
            isMatch = false;
          }


          appointmentData = {
            name          : name,
            date          : tpl.get.searchDate(),
            miles         : miles,
            address       : address,
            times         : times,
            matchingTimes : matchingTimes,
            isMatch       : isMatch,
            vaccines      : vaccines,
            phone         : phone,
            locationInfo  : locationInfo,
          };


          appointments.push(appointmentData);
        }
        return appointments;
      },

      randomElement(arrayItems) {
        if(arrayItems.length == 0) {
          return;
        }
        return arrayItems[Math.floor(Math.random() * arrayItems.length)];
      },


      vaccineText(vaccines) {
        if(vaccines instanceof Array) {
          if(vaccines.length == tpl.defaults.vaccines.length) {
            return 'All Vaccines';
          }
          return vaccines.join(', ');
        }
        return 'Data Not Available';
      },
      criteriaText(settings) {
        let
          text = ''
        ;
        if(settings.borough !== 'Any') {
          text += `${settings.borough}, `;
        }
        if(settings.vaccines) {
          text += tpl.get.vaccineText(settings.vaccines);
          text += ', ';
        }
        if(settings.maxMiles) {
          text += `${settings.maxMiles} miles max`;
        }
        text += '<br>';
        if(settings.minHour < 12) {
          text += `${settings.minHour} AM - `;
        }
        else {
          text += `${settings.minHour - 12} PM - `;
        }
        if(settings.maxHour < 12 || settings.maxHour == 24) {
          text += `${settings.maxHour} AM`;
        }
        else {
          text += `${settings.maxHour - 12} PM`;
        }
        return text.trim();
      },
      timeDiffText(startTime, endTime) {
        if(!startTime || !endTime) {
          return 'Unknown';
        }
        let
          // get total seconds between the times
          text  = '',
          ms    = Math.abs(endTime - startTime),
          delta = ms / 1000,
          days,
          hours,
          minutes,
          seconds
        ;

        if(ms == 0) {
          return '';
        }
        if(ms < 1000) {
          return `${delta} ms`;
        }

        // subtract days
        days = Math.floor(delta / 86400);
        delta -= days * 86400;

        // subtract hours
        hours = Math.floor(delta / 3600) % 24;
        delta -= hours * 3600;

        // subtract minutes
        minutes = Math.floor(delta / 60) % 60;
        delta -= minutes * 60;

        // remainder is seconds
        seconds = Math.floor(delta);
        if(days) {
          text += ` ${days} days`;
        }
        if(hours) {
          text += ` ${hours} hours`;
        }
        if(minutes) {
          text += ` ${minutes} minutes`;
        }
        if(seconds) {
          text += ` ${seconds} seconds`;
        }
        return text.trim();
      },
      searchCount() {
        if(!tpl.results) {
          return;
        }
        if(tpl.results.length == 1) {
          return `${tpl.results.length} search`;
        }
        return `${tpl.results.length} searches`;
      },
      appointmentCount() {
        let
          locations = (tpl.results || [])
            .map(result => result.appointments)
            .flat()
            .map(appointment => appointment.name),
          count = tpl.get.unique(locations).length
        ;
        return `${count} total`;
      },
      matchingCount() {
        let
          locations = (tpl.results || [])
            .map(result => result.appointments)
            .flat()
            .filter(appointment => appointment.isMatch)
            .map(appointment => appointment.name),
          count = tpl.get.unique(locations).length
        ;
        return `${count} matching`;
      }

    },

    set: {
      userSettings(userSettings) {
        Object.assign(tpl.settings, tpl.defaults, userSettings);

        // shorthand
        settings = tpl.settings;
      },
      appointmentQuery() {
        let
          dateEl   = $(selector.dateInput)[0],
          searchEl = $(selector.searchInput)[0]
        ;
        tpl.lastQueryTime = performance.now();
        if(dateEl) {
          dateEl.value = null;
          dateEl.value = tpl.get.displayDate();
        }
        if(searchEl) {
          searchEl.value = null;
          searchEl.value = settings.zipcode;
        }
      },
      defaultSettings() {
        let
          existingZipcode  = $(selector.searchInput)[0],
          zipcodeEl        = $$('settingsModal input[name="zipcode"]')[0],
          searchIntervalEl = $$('settingsModal input[name="searchInterval"]')[0],
          checkDelayEl     = $$('settingsModal input[name="checkDelay"]')[0]
        ;
        if(existingZipcode) {
          zipcodeEl.value = existingZipcode.value;
        }
        if(tpl.defaults.searchInterval) {
          searchIntervalEl.value = tpl.defaults.searchInterval;
        }
        if(tpl.defaults.checkDelay) {
          checkDelayEl.value = tpl.defaults.checkDelay;
        }
      },
      searchOverlayText() {
        let
          timeEl = $$('overlay .time')[0],
          timeText
        ;
        let
          elements    = {
            totalTime        : $$('overlay .totalTime')[0],
            searchCount      : $$('overlay .searchCount')[0],
            appointmentCount : $$('overlay .appointmentCount')[0],
            matchingCount    : $$('overlay .matchingCount')[0],
            criteria         : $$('overlay .criteria')[0],
            searchInterval   : $$('overlay .searchInterval')[0],
          },
          values = {
            totalTime        : tpl.get.timeDiffText(tpl.startTime, new Date()) || '',
            searchCount      : tpl.get.searchCount(),
            appointmentCount : tpl.get.appointmentCount(),
            matchingCount    : tpl.get.matchingCount(),
            criteria         : tpl.get.criteriaText(settings),
            searchInterval   : settings.searchInterval,
          }
        ;
        for(let [name, element] of Object.entries(elements)) {
          if(values[name]) {
            element.innerHTML = values[name];
          }
        }
      },
      selectedAppointmentTable() {
        if(!tpl.selectedAppointment || !tpl.selectedTime) {
          return;
        }
        let
          appointment = clone(tpl.selectedAppointment),
          time        = clone(tpl.selectedTime),
          elements    = {
            name             : $$('completedModal td.name')[0],
            time             : $$('completedModal td.time')[0],
            vaccines         : $$('completedModal td.vaccines')[0],
            address          : $$('completedModal td.address')[0],
            distance         : $$('completedModal td.distance')[0],
            criteria         : $$('completedModal td.criteria')[0],
            totalTime        : $$('completedModal td.totalTime')[0],
            searchCount      : $$('completedModal td.searchCount')[0],
            appointmentCount : $$('completedModal td.appointmentCount')[0],
            matchingCount    : $$('completedModal td.matchingCount')[0],
          },
          values = {
            name             : appointment.name,
            time             : `${appointment.date || ''} ${time.text}`,
            address          : tpl.get.htmlAddress(appointment.address),
            distance         : `${appointment.miles} miles`,
            vaccines         : tpl.get.vaccineText(appointment.vaccines),
            criteria         : tpl.get.criteriaText(settings),
            totalTime        : tpl.get.timeDiffText(tpl.startTime, tpl.completedTime),
            searchCount      : tpl.get.searchCount(),
            appointmentCount : tpl.get.appointmentCount(),
            matchingCount    : tpl.get.matchingCount(),
          }
        ;
        tpl.log('Appointment reserved', appointment);
        for(let [name, element] of Object.entries(elements)) {
          if(values[name]) {
            element.innerHTML = values[name];
          }
        }
      }
    },

    select: {
      appointment(appointment, time) {
        tpl.select.appointmentTime(time.element);
        tpl.selectedAppointment = appointment;
        tpl.selectedTime = time;
        tpl.completedTime = new Date();
      },
      appointmentTime(timeEl) {
        if(!timeEl) {
          return;
        }
        timeEl.click();
        $(selector.nextButton)[0].click();
      }
    },

    show: {
      modal(selector) {
        let
          dimmerEl = $$('contentInject .dimmer')[0],
          modalEl  = dimmerEl.querySelectorAll(selector)[0]
        ;
        dimmerEl.classList.add('visible');
        modalEl.classList.add('visible');
      },
      searchOverlay() {
        let
          overlayEl = $$('overlay')[0]
        ;
        overlayEl.classList.add('visible');
      },
      confetti() {
        let
          dimmerEl = document.querySelectorAll('contentInject .dimmer')[0],
          canvas   = document.createElement('canvas')
        ;
        dimmerEl.insertAdjacentElement('beforeend', canvas);
        tpl.animate.confetti(canvas);
      },
      settingsModal() {
        tpl.set.defaultSettings();
        tpl.show.modal('settingsModal');
      },
      completedModal() {
        tpl.set.selectedAppointmentTable();
        tpl.hide.searchOverlay();
        tpl.show.modal('completedModal');
        tpl.show.confetti();
      },
      errorModal() {
        tpl.show.modal('errorModal');
      }
    },

    hide: {
      modal(selector = '.modal') {
        let
          dimmerEl = document.querySelectorAll('contentInject .dimmer')[0],
          modalEl  = dimmerEl.querySelectorAll(selector)[0]
        ;
        dimmerEl.classList.remove('visible');
        modalEl.classList.remove('visible');
      },
      searchOverlay() {
        let
          overlayEl = $$('overlay')[0]
        ;
        overlayEl.classList.remove('visible');
      },
      confetti() {
        let
          canvas = document.querySelectorAll('contentInject canvas')[0]
        ;
        cancelAnimationFrame(tpl.confettiAnimationFrame);
        canvas.remove();
      }
    },

    animate: {
      // adapted from a funny coffeescript codepen here <https://codepen.io/linrock/pen/Amdhr>
      confetti(canvas) {

        let
          speed = 1,
          count = 150,
          COLORS,
          Confetti,
          NUM_CONFETTI,
          PI_2,
          confetti,
          context,
          drawCircle,
          i,
          range,
          resizeWindow,
          xpos
        ;

        NUM_CONFETTI = count;

        COLORS = tpl.confettiColors;

        PI_2 = 2 * Math.PI;

        context = canvas.getContext('2d');

        context.clearRect(0, 0, canvas.width, canvas.height);

        window.w = 0;
        window.h = 0;
        resizeWindow = function() {
          window.w = canvas.width = window.innerWidth;
          return window.h = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeWindow);
        resizeWindow();

        range = function(a, b) {
          return (b - a) * Math.random() + a;
        };

        drawCircle = function(x, y, r, style) {
          context.beginPath();
          context.arc(x, y, r, 0, PI_2, false);
          context.fillStyle = style;
          return context.fill();
        };

        xpos = 1;
        ypos = 1;
        document.body.addEventListener('mousemove', function(event) {
          xpos = event.pageX / w;
          ypos = event.pageY / h;
        });

        Confetti = (function() {
          function Confetti() {
            this.style = COLORS[~~range(0, 5)];
            this.rgb = 'rgba(' + this.style[0] + ',' + this.style[1] + ',' + this.style[2];
            this.r = ~~range(2, 6);
            this.r2 = 2 * this.r;
            this.replace();
          }

          Confetti.prototype.replace = function() {
            this.opacity = 0;
            this.dop = 0.005 * range(1, 2);
            this.x = range(-this.r2, w - this.r2);
            this.y = range(-20, h - this.r2);
            this.xmax = w - this.r;
            this.ymax = h - this.r;
            this.vx = range(0, 4) + 4 * xpos - 4;
            return this.vy = (0.6 * ypos + 0.2) * this.r + range(-1, 1);
          };

          Confetti.prototype.draw = function() {
            let ref;
            this.x += this.vx;
            this.y += this.vy;
            this.opacity += this.dop;
            if (this.opacity > 1) {
              this.opacity = 1;
              this.dop *= -1;
            }
            if (this.opacity < 0 || this.y > this.ymax) {
              this.replace();
            }
            if (!(((ref = this.x) > 0 && ref < this.xmax))) {
              this.x = (this.x + this.xmax) % this.xmax;
            }
            return drawCircle(~~this.x, ~~this.y, this.r, this.rgb + ',' + this.opacity + ')');
          };

          return Confetti;

        })();

        confetti = (function() {
          let j, ref, results;
          results = [];
          for (i = j = 1, ref = NUM_CONFETTI; ref >= 1 ? j <= ref : j >= ref; i = ref >= 1 ? ++j : --j) {
            results.push(new Confetti);
          }
          return results;
        })();

        let step = function() {
          let c, j, len, results;
          tpl.confettiAnimationFrame = requestAnimationFrame(step);
          context.clearRect(0, 0, w, h);
          results = [];
          for (j = 0, len = confetti.length; j < len; j++) {
            c = confetti[j];
            results.push(c.draw());
          }
          return results;
        };

        step();
      }
    },

    clear: {
      selectedAppointment() {
        delete tpl.selectedAppointment;
        delete tpl.selectedTime;
      },
      search() {
        delete tpl.completedTime;
        delete tpl.selectedAppointment;
        delete tpl.selectedTime;
        tpl.results = [];
      }
    },

    event: {
      documentChanged(mutations) {

        if(tpl.useInterval) {
          tpl.log('Checking for results');
        }
        else {
          tpl.log('Mutations detected', mutations);
        }
        /*
        // results are loading still
        if($(selector.loader).length > 0) {
          tpl.log('A) Loader detected');
          return;
        }
        */
        // no results found
        if($(selector.noResults).length > 0) {
          tpl.log('B) No results detected');
          tpl.results.push({
            completed     : new Date(),
            executionTime : performance.now() - tpl.lastQueryTime,
            appointments  : []
          });
          tpl.searchAgain();
          return;
        }

        else if($(selector.errorModal).length > 0) {
          // click the find new apt button
          tpl.failedTime = tpl.selectedTime;
          tpl.clear.selectedAppointment();
          let
            errorButtonEl = $(selector.errorModalButton)[0]
          ;
          if(errorButtonEl) {
            errorButtonEl.click();
          }
        }

        // check if new page content is in the DOM
        else if($(selector.appointment).length > 0) {
          let
            appointments = tpl.get.appointmentList(),
            matchingAppointments = appointments.filter(appointment => appointment.isMatch),
            appointment = tpl.get.randomElement(matchingAppointments)
          ;
          tpl.log('C) Appointments Found');
          tpl.log(appointments);
          tpl.log(matchingAppointments);
          tpl.results.push({
            completed            : new Date(),
            executionTime        : performance.now() - tpl.lastQueryTime,
            appointments         : appointments,
            matchingAppointments : matchingAppointments,
          });

          if(matchingAppointments.length == 0) {
            tpl.log('No matching appointments found', appointments);
            tpl.searchAgain();
            return;
          }
          let
            time = tpl.get.randomElement(appointment.matchingTimes)
          ;
          tpl.log('Matching appointment found', appointment);
          tpl.select.appointment(appointment, time);
          return;
        }

        // check if made it to patient info screen
        else if($(selector.patientInfo).length > 0) {
          tpl.log('d) appointment selected. patient info screen');
          if(tpl.selectedAppointment) {
            tpl.stop();
            tpl.show.completedModal();
          }
          else {
            $(selector.previousButton)[0].click();
          }
          return;
        }

        else {
          tpl.log('e) no conditions detected');
        }
      },
      submitSettingsClick(event) {
        let
          settings     = {},
          formEl       = document.querySelectorAll('settingsModal form')[0],
          formElements = formEl.elements,
          hasErrors    = false
        ;
        for(let index = 0; index < formElements.length; index++) {
          let
            input    = formElements[index],
            name     = input.name,
            value    = input.value,
            checked
          ;
          if(['zipcode', 'maxMiles'].includes(name) && !value) {
            input.parentElement.classList.add('error');
            input.focus();
            hasErrors = true;
          }
          else {
            input.parentElement.classList.remove('error');
            if(name.split('[]').length > 1) {
              name = name.split('[]')[0];
              if(!settings[name]) {
                settings[name] = [];
              }
              if(input.checked) {
                settings[name].push(value);
              }
            }
            else {
              if(['searchInterval', 'maxDistance', 'checkDelay', 'minHour', 'maxHour'].includes(name)) {
                value = Number(value);

                // prevent low values for interval
                if(name == 'searchInterval' && value < tpl.minSearchInterval) {
                  value = tpl.minSearchInterval;
                }
              }
              settings[name] = value;
            }
          }
        }
        if(hasErrors) {
          return;
        }
        tpl.set.userSettings(settings);
        tpl.hide.modal();
        tpl.start();
      },
      modifyOverlayClick(event) {
        tpl.stop();
        tpl.hide.searchOverlay();
        tpl.show.settingsModal();
      },
      cancelOverlayClick(event) {
        tpl.hide.searchOverlay();
        tpl.stop();
      },
      cancelSettingsClick(event) {
        tpl.hide.modal();
      },
      completedSubmitClick(event) {
        tpl.hide.modal();
      },
      completedCancelClick(event) {
        $(selector.previousButton)[0].click();
        tpl.start();
        tpl.hide.modal();
      },
      completedNewClick(event) {
        $(selector.previousButton)[0].click();
        tpl.hide.modal();
        tpl.initialize();
      },
      errorCancelEl(event) {
        tpl.hide.modal();
        tpl.destroy();
      },
    },


  };



  // templates and css
  css = `
    @import url('https://fonts.googleapis.com/css?family=Cormorant+Garamond:700i|Fira+Sans');

    /*
      UI
    */

    contentInject {
      font-family: 'Fira Sans';
    }

    /* Header */
    contentInject .header {
      font-family: 'Cormorant Garamond';
    }

    contentInject .error.message {
      background-color: #fff7f7 !important;
      color: #e03737;
      font-weight: bold;
      margin-bottom: 1rem;
    }

    contentInject a {
      text-decoration: none !important;
    }

    /* Button */
    contentInject .button {
      display: inline-block;
      cursor: pointer;
      margin: 0px 7px 0px 0px;
      background-color: #000000;
      transition: 0.2s all ease;
      padding: 12px 15px;
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      border-radius: 5px;
    }
    contentInject .button {
      background-color: #EEEEEE;
      color: #555555;
    }
    contentInject .button:hover {
      background-color: #DDDDDD;
    }
    contentInject .primary.button {
      background-color: #000000;
      color: #FFFFFF;
    }
    contentInject .primary.button:hover {
      background-color: #EC5E5E;
    }


    /* Dimmer */
    contentInject .dimmer {
      position: fixed;
      top: 0px;
      left: 0px;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      background-color: rgba(0, 0, 0, 0.85);
      z-index: 10;
      transition: 0.5s ease opacity;
    }
    contentInject .dimmer > canvas {
      position: absolute;
      top: 0%;
      left: 0%;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    contentInject .dimmer .confetti {
      position: absolute;
      width: 100%;
      height: 100%;
    }
    contentInject .dimmer.visible {
      pointer-events: auto;
      opacity: 1;
    }

    /* Modal */
    contentInject .modal {
      display: none;
      flex-direction: column;
      position: relative;
      background-color: #FFFFFF;
      box-shadow: 0px 5px 30px rgba(0, 0, 0, 0.6);
      border-radius: 5px;
      overflow: hidden;
      width: 800px;
      min-height: 500px;
      z-index: 11;
      opacity: 0;
      transition: 0.5s ease opacity;
    }
    contentInject .modal.visible {
      display: flex;
      opacity: 1;
    }
    contentInject .modal > .header {
      font-size: 36px;
      font-weight: bold;
      padding: 2rem 2rem;
      flex: 0 1 auto;
      border-bottom: 1px solid #DADADA;
    }
    contentInject .modal .content {
      padding: 1rem 2rem;
      flex: 1 1 auto;
    }
    contentInject .modal .content .header {
      font-family: 'Fira Sans';
      font-size: 18px;
      margin: 15px 0px 10px;
      line-height: 1.4;
      padding: 0px;
    }
    contentInject .modal .content p {
      font-size: 14px !important;
    }
    contentInject .modal .message {
      background-color: #EAEAEA;
      border-radius: 5px;
      padding: 1rem;
    }
    contentInject .modal .actions {
      padding: 2rem 2rem;
      text-align: right;
    }
    contentInject .modal .actions .button {
      margin: 0px 0px 0px 14px;
    }

    /* Forms */
    contentInject .fields {
      display: flex;
      flex-direction: row;
      margin: 0rem -1rem -1rem;
    }
    contentInject .fields .field {
      flex: 1 0 auto;
      margin: 1rem 1rem;
    }
    contentInject .fields .field label {
      display: block;
      font-size: 13px;
      text-transform: uppercase;
      font-weight: bold;
      margin-bottom: 3px;
    }
    contentInject .fields .field select,
    contentInject .fields .field input {
      border: 1px solid #DDDDDD;
      border-radius: 5px;
      padding: 10px 8px;
    }
    contentInject .fields .field select,
    contentInject .fields .field input[type="text"] {
      width: 100%;
    }
    contentInject .fields .field input:focus {
      border: 1px solid #AAAAAA !important;
      outline: none !important;
    }

    contentInject .fields .field.error select,
    contentInject .fields .field.error input[type="text"] {
      background-color: #FFF6F6;
      border-color: #EFB2B2;
    }

    /* Grid */
    contentInject .grid {
      display: flex;
      flex-direction: row;
    }
    contentInject .grid > .column {
      flex-grow: 1;
      width: 50%;
    }

    /* Table */
    contentInject table td {
      padding: 5px 8px;
    }
    contentInject table td:first-child {
      color: rgba(0, 0, 0, 0.6);
      text-transform: uppercase;
      font-size: 12px;
      padding-left: 0px;
    }

    contentInject table td:last-child {
      font-weight: bold;
      color: #000000;
    }

    /* Loader */
    contentInject .loader {
      position: relative;
      width: 50px;
      height: 50px;
      left: -25px;
    }
    contentInject .loader:after {
      animation: loader 500ms linear;
      animation-iteration-count: infinite;
      border-radius: 500rem;
      border-color: #272727 #272727 #CCCCCC #CCCCCC;
      border-style: solid;
      border-width: 3px;
    }
    contentInject .loader:after,
    contentInject .loader:before {
      position: absolute;
      content: '';
      top: 0;
      left: 50%;
      width: 100%;
      height: 100%;
    }
    /* Active Animation */
    @keyframes loader {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    contentInject overlay {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 450px;
      padding: 20px 25px;
      border-radius: 5px;
      background-color: #FFFFFF;
      border: 1px solid #ECECEC;
      box-shadow:
        0px 15px 35px rgba(50, 50, 93, 0.1),
        0px 5px 15px rgba(0, 0, 0, 0.07)
      ;
      z-index: 99999;
      opacity: 0;
      transform: translateY(-400px);
      transition: transform 0.5s ease;
    }
    contentInject overlay.visible {
      opacity: 1;
      transform: translateY(0px);
    }
    contentInject overlay top {
      display: flex;
      flex-direction: row;
    }
    contentInject overlay top .content {
      flex: 1 1 auto;
    }
    contentInject overlay top .content .status {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 4px;
    }
    contentInject overlay top .content .progress {
      font-size: 16px;
      font-weight: bold;
      color: #F52635;
    }
    contentInject overlay top .content .stats {
      display: block;
      padding: 5px 0px;
      border-radius: 5px;
    }
    contentInject overlay top .content .stats .stat {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
      font-weight: normal;
    }
    contentInject overlay top .content .stat b {
      color: #000000;
      font-weight: bold !important;
    }
    contentInject overlay top .loader {
      flex: 0 0 auto;
    }
    contentInject overlay top .loader + .content {
      padding-left: 20px;
    }
    contentInject overlay bottom .logo {
      float: right;
      padding: 0px !important;
    }
    contentInject overlay bottom .logo img {
      display: block;
      height: 30px !important;
    }
    contentInject overlay bottom {
      display: block;
      padding: 1rem 0rem 0rem;
    }
    contentInject overlay bottom a {
      display: inline-block;
      cursor: pointer;
      font-size: 13px;
      margin-right: 10px;
      vertical-align: top;
      font-weight: bold;
      text-decoration: none;
    }
    contentInject overlay bottom a:hover {
      color: #009FDA;
      text-decoration: none !important;
    }
    contentInject errorModal p {
      font-size: 16px;
    }

  `;

  settingsModal = `
    <settingsModal class="modal">
      <div class="header">
        Set up Vax Butler
      </div>
      <div class="content">
        <p>Please enter your desired constraints for finding your vaccine booking.</p>
        <form>
          <div class="fields">
            <div class="field">
              <label>Zipcode</label>
              <input name="zipcode" type="text">
            </div>
            <div class="field">
              <label>Max Distance (Miles)</label>
              <input name="maxDistance" value="30" type="text">
            </div>
            <div class="field">
              <label>Borough</label>
              <select name="borough">
                <option value="Any">Any</option>
                <option value="Brooklyn">Brooklyn</option>
                <option value="Bronx">Bronx</option>
                <option value="Manhattan">Manhattan</option>
                <option value="Queens">Queens</option>
                <option value="Staten Island">Staten Island</option>
              </select>
            </div>
          </div>
          <div class="fields">
            <div class="field">
              <label>Earliest Hour</label>
              <select name="minHour">
                <option value="0" selected>12:00 AM (Midnight)</option>
                <option value="1">1:00 AM</option>
                <option value="2">2:00 AM</option>
                <option value="3">3:00 AM</option>
                <option value="4">4:00 AM</option>
                <option value="5">5:00 AM</option>
                <option value="6">6:00 AM</option>
                <option value="7" selected>7:00 AM</option>
                <option value="8">8:00 AM</option>
                <option value="9">9:00 AM</option>
                <option value="10">10:00 AM</option>
                <option value="11">11:00 AM</option>
                <option value="12">12:00 PM (Noon)</option>
                <option value="13">1:00 PM</option>
                <option value="14">2:00 PM</option>
                <option value="15">3:00 PM</option>
                <option value="16">4:00 PM</option>
                <option value="17">5:00 PM</option>
                <option value="18">6:00 PM</option>
                <option value="19">7:00 PM</option>
                <option value="20">8:00 PM</option>
                <option value="21">9:00 PM</option>
                <option value="22">10:00 PM</option>
                <option value="23">11:00 PM</option>
              </select>
            </div>
            <div class="field">
              <label>Latest Hour</label>
              <select name="maxHour">
                <option value="1">1:00 AM</option>
                <option value="2">2:00 AM</option>
                <option value="3">3:00 AM</option>
                <option value="4">4:00 AM</option>
                <option value="5">5:00 AM</option>
                <option value="6">6:00 AM</option>
                <option value="7">7:00 AM</option>
                <option value="8">8:00 AM</option>
                <option value="9">9:00 AM</option>
                <option value="10">10:00 AM</option>
                <option value="11">11:00 AM</option>
                <option value="12">12:00 PM (Noon)</option>
                <option value="13">1:00 PM</option>
                <option value="14">2:00 PM</option>
                <option value="15">3:00 PM</option>
                <option value="16">4:00 PM</option>
                <option value="17">5:00 PM</option>
                <option value="18">6:00 PM</option>
                <option value="19">7:00 PM</option>
                <option value="20">8:00 PM</option>
                <option value="21">9:00 PM</option>
                <option value="22" selected>10:00 PM</option>
                <option value="23">11:00 PM</option>
                <option value="24">12:00 PM (Midnight)</option>
              </select>
            </div>
          </div>
          <h3 class="header">
            Vaccine Selection
          </h3>
          <p>Limit appointments to only those offering:</p>
          <div class="fields">
            <div class="field">
              <label>Pfizer (High Efficacy)</label>
              <input name="vaccines[]" value="Pfizer" type="checkbox" checked>
            </div>
            <div class="field">
              <label>Moderna (High Efficacy)</label>
              <input name="vaccines[]" value="Moderna" type="checkbox" checked>
            </div>
            <div class="field">
              <label>Johnson & Johnson (Single Dose)</label>
              <input name="vaccines[]" value="Johnson & Johnson" type="checkbox" checked>
            </div>
          </div>
          <h3 class="header">
            Configure Butler
          </h3>
          <p>
            <b>Note: Searching too quickly may cause errors that block you out of the system.</b>
          </p>
          <div class="fields">
            <div class="field">
              <label>Repeat Search Every (X) Seconds</label>
              <input name="searchInterval" value="1" type="text">
            </div>
            <div class="field">
              <label>Check Page (X) Seconds After Search</label>
              <input name="checkDelay" value="1" type="text">
            </div>
          </div>
        </form>
      </div>
      <div class="actions">
        <cancel class="button">
          Cancel
        </cancel>
        <submit class="primary button">
          Start Search
        </submit>
      </div>
    </settingsModal>
  `;

  completedModal = `
    <completedModal class="modal">
      <div class="header">
        Your Appointment Is Reserved!
      </div>
      <div class="content">
        <div class="message">
          We've reserved you a vaccine appointment. If you are happy with this appointment, please select "continue" below and complete the rest of the submission form.
        </div>
        <div class="grid">
          <div class="column">
            <h3 class="ui header">
              Appointment
            </h3>
            <table>
              <tbody>
                <tr>
                  <td>
                    Location
                  </td>
                  <td class="name">
                  </td>
                </tr>
                <tr>
                  <td>
                    Time
                  </td>
                  <td class="time">
                  </td>
                </tr>
                <tr>
                  <td>
                    Location Vaccines
                  </td>
                  <td class="vaccines">
                  </td>
                </tr>
                <tr>
                  <td>
                    Address
                  </td>
                  <td class="address">
                  </td>
                </tr>
                <tr>
                  <td>
                    Distance
                  </td>
                  <td class="distance">
                    <a href="#">
                      Get Directions
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="column">
            <h3 class="ui header">
              Your Search
            </h3>
            <table>
              <tbody>
                <tr>
                  <td>
                    Criteria
                  </td>
                  <td class="criteria">
                  </td>
                </tr>
                <tr>
                  <td>
                    Total Time
                  </td>
                  <td class="totalTime">
                  </td>
                </tr>
                <tr>
                  <td>
                    Searches Made
                  </td>
                  <td class="searchCount">
                  </td>
                </tr>
                <tr>
                  <td>
                    Appointments Found
                  </td>
                  <td class="appointmentCount">
                  </td>
                </tr>
                <tr>
                  <td>
                    Matching Appointments
                  </td>
                  <td class="matchingCount">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="actions">
        <new class="button">
          New Search
        </new>
        <cancel class="button">
          Redo Search
        </cancel>
        <submit class="primary button">
          Continue
        </submit>
      </div>
    </completedModal>
  `;

  searchOverlay = `
    <overlay>
      <top>
        <div class="content">
          <div class="status">Finding appointment...</div>
          <div class="progress">Note: Screen may flicker with reloads</div>
          <div class="stats">
            <div class="stat">
              <b><span class="searchCount"></span></b> made, time elapsed
              <b><span class="totalTime"></span></b>.
            </div>
            <div class="stat">
              Searching every <b><span class="searchInterval"></span> seconds</b>
            </div>
            <div class="stat">
              <b><span class="appointmentCount"></span> appointments</b> returned so far.
            </div>
            <div class="stat">
              <b><span class="matchingCount"></span> appointments found</b>.
            </div>
            <div class="stat">
              Looking for appointments matching:<br>
              <b><span class="criteria"></span></b>
            </div>
          </div>
        </div>
        <div class="loader"></div>
      </top>
      <bottom>
        <a class="logo" href="https://www.vaccinebutler.com" target="_blank">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJMAAAAeCAYAAAAoyywTAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyNpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDYuMC1jMDA2IDc5LjE2NDc1MywgMjAyMS8wMi8xNS0xMTo1MjoxMyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIyLjMgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjFFNjUxQjA1OTYxQTExRUI5RUI4RDA0Q0U5RTY0QzhGIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjFFNjUxQjA2OTYxQTExRUI5RUI4RDA0Q0U5RTY0QzhGIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6MUU2NTFCMDM5NjFBMTFFQjlFQjhEMDRDRTlFNjRDOEYiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6MUU2NTFCMDQ5NjFBMTFFQjlFQjhEMDRDRTlFNjRDOEYiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4UEczrAAARqElEQVR42uxbC3RV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">
        </a>
        <a class="modify">Modify Search</a>
        <a class="cancel">Cancel</a>
      </bottom>
    </overlay>
  `;

  errorModal = `
    <errorModal class="modal">
      <div class="header">
        Wrong Domain - Vaccine Butler
      </div>
      <div class="content">
        <p>
          Vaccine butler is designed to be run only while visiting <b>vax4nyc.nyc.gov</b>. For more information please review our <a href="https://www.vaccinebutler.com/setup">set up guide</a>.
        </p>

        <p>Click a link below to be redirected to the registration form for your vaccine</p>

        <div class="error message">
          You will need to restart vaccine butler after you click a link below.
        </div>

        <a class="primary button" href="https://vax4nyc.nyc.gov/patient/s/vaccination-schedule">
          Schedule First Dose
        </a>
        <a class="primary button" href="https://vax4nyc.nyc.gov/patient/s/dose2">
          Schedule Second Dose
        </a>
        <br><br>
        <a class="primary button" href="https://vax4nyc.nyc.gov/patient/s/">
          Overview
        </a>
        <a class="primary button" href="https://vax4nyc.nyc.gov/patient/s/reschedule-appointment">
          Reschedule
        </a>
        <br><br>
        <cancel class="button">
          Cancel
        </cancel>
      </div>
    </errorModal>
  `;

  html = `
    <div class="dimmer">
      ${settingsModal}
      ${completedModal}
      ${errorModal}
    </div>
    ${searchOverlay}
  `;

  // needs to be updated manually to stay up to date
  // found in locations.json
  locations = JSON.parse(`[{"name":"Walgreens/Duane Reade","address":"750 Manhattan Avenue, Brooklyn, 11222","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"783 Manhattan Avenue, Brooklyn, 11222","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"250 Bedford Avenue, Brooklyn, 11249","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"164 Kent Avenue, Brooklyn, 11249","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"210 Union Avenue, Brooklyn, 11211","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"1-50 50th Ave, Queens, 11101","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"47-02 5th Street, Queens, 11101","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Long Island City","address":"5-17 46th Road, Queens, 11101","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"85 Avenue D, Manhattan, 10009","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"755 Broadway, Brooklyn, 11206","vaccines":["Pfizer"]},{"name":"Ryan Health - Nena Community Health Center","address":"279 East 3rd Street, Manhattan, 10009","vaccines":["Moderna"]},{"name":"NYC Health + Hospitals, Woodhull","address":"760 Broadway, Brooklyn, 11206","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Bellevue","address":"462 1st Avenue, Manhattan, 10016","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"298 1st Avenue, Manhattan, 10009","vaccines":["Pfizer"]},{"name":"Remedies Pharmacy","address":"711 Bedford Avenue, Brooklyn, 11206","vaccines":["Moderna"]},{"name":"ODA Primary Healthcare Network","address":"74 Wallabout Street, Brooklyn, 11249","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"194 East 2nd Street, Manhattan, 10009","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"46-12 Greenpoint Avenue, Queens, 11104","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"465 2nd Avenue, Manhattan, 10016","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"45-02 43rd Avenue, Queens, 11104","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"300 East 39th Street, Manhattan, 10016","vaccines":["Pfizer"]},{"name":"St. Jude Pharmacy","address":"121 St. Nicholas Avenue, Brooklyn, 11237","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"81 1st Avenue, Manhattan, 10003","vaccines":["Moderna"]},{"name":"Ford Foundation","address":"321 E 42nd Street, Manhattan, 10017","vaccines":["Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"756 Myrtle Avenue, Brooklyn, 11206","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"125 3rd Avenue, Manhattan, 10003","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"355 Knickerbocker Avenue, Brooklyn, 11237","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"50-15 Roosevelt Avenue, Queens, 11377","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"408 Grand Street, Manhattan, 10002","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"155 East 34th Street, Manhattan, 10016","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"852 2nd Avenue, Manhattan, 10017","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"100 Delancey Street, Manhattan, 10002","vaccines":["Pfizer"]},{"name":"NYC Vaccine Hub - Essex Crossing","address":"244B Broome Street, Manhattan, 10002","vaccines":["Moderna"]},{"name":"Gotham Health, Gouverneur","address":"227 Madison Street, Manhattan, 10002","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"931 1st Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Endocrine Associate of West Village, PC","address":"36-36 33rd Street, Suite 311, Queens, 11106","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"145 4th Avenue, Manhattan, 10003","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"215 Park Avenue South, Manhattan, 10003","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"401 Park Avenue South, Manhattan, 10016","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"711 3rd Avenue, Manhattan, 10017","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1 Union Square South, Manhattan, 10003","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"425 Main Street, Manhattan, 10044","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"58-02 Metropolitan Avenue, Queens, 11385","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"4 Park Avenue, Manhattan, 10016","vaccines":["Pfizer"]},{"name":"Medrite Urgent Care","address":"504 Myrtle Ave, Brooklyn, 11215","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"122 East 42nd Street, Manhattan, 10168","vaccines":["Pfizer"]},{"name":"AdvantageCare Physicians - Flatiron District Medical Office","address":"21 East 22nd Street, Manhattan, 10010","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"485 Lexington Avenue, Manhattan, 10017","vaccines":["Moderna"]},{"name":"Myrtle Drugs","address":"1454 Myrtle Avenue, Brooklyn, 11237","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1052 1st Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"58-01 Queens Boulevard, Queens, 11377","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"583 Grandview Avenue, Queens, 11385","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"26 Grand Central Terminal, Manhattan, 10017","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"4 West 4th Street, Manhattan, 10012","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"866 3rd Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"379 Myrtle Avenue, Brooklyn, 11205","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"20 University Place, Manhattan, 10003","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"350 5th Avenue, Manhattan, 10118","vaccines":["Moderna"]},{"name":"Centers Urgent Care - Middle Village","address":"61-22 Fresh Pond Road, Queens, 11379","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"575 Lexington Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Gotham Health, Cumberland","address":"100 North Portland Avenue, Brooklyn, 11205","vaccines":["Moderna"]},{"name":"RendrCare: Chinatown Medical Physician","address":"86 Bowery, 4 Floor, Manhattan, 10013","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"60 Spring Street, Manhattan, 10012","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"32-87 Steinway Street, Queens, 11103","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"949 3rd Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"5411 Myrtle Avenue, Queens, 11385","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"304 Park Ave South, Manhattan, 10010","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"33-55 Crescent Street, Queens, 11106","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"60-02 Roosevelt Avenue, Queens, 11377","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"777 Avenue Of The Americas, Manhattan, 10001","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"60-26 Woodside Avenue, Queens, 11377","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"530 5th Avenue, Manhattan, 10036","vaccines":["Pfizer"]},{"name":"Hospital for Special Surgery Pod - Rockefeller University Kellen Biolink","address":"594 East 68th Street, Manhattan, 10065","vaccines":["Pfizer"]},{"name":"NYC Vaccine Hub - Bushwick Educational Campus","address":"400 Irving Avenue, Brooklyn, 11237","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"49 East 52nd Street, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"501 Avenue Of The Americas, Manhattan, 10011","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1191 2nd Avenue, Manhattan, 10065","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1350 Broadway, Manhattan, 10018","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"55-60 Myrtle Avenue, Queens, 11385","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"32-14 31st Street, Queens, 11106","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"35-06 Broadway, Queens, 11106","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1366 Broadway, Brooklyn, 11221","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"459 Broadway, Manhattan, 10013","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"47-07 Broadway, Queens, 11103","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"773 Lexington Avenue, Manhattan, 10065","vaccines":["Moderna"]},{"name":"Hospital for Special Surgery","address":"525 East 71st Street, Belaire building (courtyard and ground floor), Manhattan, 10021","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"333 7th Avenue, Manhattan, 10001","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"180 West 20th Street, Manhattan, 10011","vaccines":["Moderna"]},{"name":"RendrCare: Metro True Care Medical","address":"139 Centre Street, #709, Manhattan, 10013","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1430 Broadway, Manhattan, 10018","vaccines":["Pfizer"]},{"name":"Charles B Wang Community Health Center","address":"268 Canal Street, Manhattan, 10013","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"77 7th Avenue, Manhattan, 10011","vaccines":["Moderna"]},{"name":"Hopkins Drugs & Compounding","address":"63-19 Roosevelt Avenue, Queens, 11377","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"1440 Broadway, Manhattan, 10018","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"21-25 Broadway, Queens, 11106","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1111 3rd Avenue, Manhattan, 10065","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"41 East 58th Street, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Apicha Primary Care Clinic","address":"400 Broadway, Manhattan, 10013","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2 Penn Plaza, Manhattan, 10121","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"51 West 51st Street, Manhattan, 10019","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"7 Madison Street, Manhattan, 10038","vaccines":["Moderna"]},{"name":"NYC Health Dept. - Fort Greene Clinic","address":"295 Flatbush Ave, 5th floor, Brooklyn, 11201","vaccines":["Moderna"]},{"name":"Lenox Health Greenwich Village","address":"200 W 13th Street, Manhattan, 10011","vaccines":["Pfizer"]},{"name":"NYC Health Dept. - Downtown Clinic","address":"125 Worth Street, Manhattan, 10013","vaccines":["Moderna"]},{"name":"COSTCO Pharmacy","address":"32-50 Vernon Boulevard, Queens, 11106","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"161 Avenue Of The Americas, Manhattan, 10013","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1352 1st Avenue, Manhattan, 10021","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"282 8th Avenue, Manhattan, 10001","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1328 2nd Avenue, Manhattan, 10021","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - City Point","address":"445 Albee Square West, Brooklyn, 11201","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1251 Avenue Of The Americas, Manhattan, 10020","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"460 8th Avenue, Manhattan, 10001","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"1172 3rd Avenue, Manhattan, 10065","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"559 Fulton Street, Brooklyn, 11201","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1281 Fulton Street, Brooklyn, 11216","vaccines":["Moderna"]},{"name":"Legacy Specialty Pharmacy","address":"68-51 Fresh Pond Road, Queens, 11385","vaccines":["Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"305 Broadway, Manhattan, 10007","vaccines":["Pfizer"]},{"name":"Bedford-Stuyvesant Restoration Corporation","address":"1368 Fulton Street, Community Room, Brooklyn, 11216","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"386 Fulton Street, Brooklyn, 11201","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"100 West 57th Street, Manhattan, 10019","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"625 8th Avenue, Manhattan, 10018","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"16 Court Street, Brooklyn, 11241","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"534 Hudson Street, Manhattan, 10014","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"661 8th Avenue, Manhattan, 10036","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1627 Broadway, Manhattan, 10019","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"188 9th Avenue, Manhattan, 10011","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"60-36 Myrtle Avenue, Queens, 11385","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"960 Halsey Street, Brooklyn, 11233","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"33-01 30th Avenue, Queens, 11103","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1498 York Avenue, Manhattan, 10075","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"200 Water Street, Manhattan, 10038","vaccines":["Pfizer"]},{"name":"AdvantageCare Physicians - Downtown Medical Office","address":"447 Atlantic Avenue, Brooklyn, 11217","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"250 Broadway, Manhattan, 10007","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"101 Clinton Street, Brooklyn, 11201","vaccines":["Moderna"]},{"name":"Interfaith Medical Center","address":"1545 Atlantic Avenue, Brooklyn, 11213","vaccines":["Pfizer","Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"28-58 Steinway Street, Queens, 11103","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"301 West 50th Street, Manhattan, 10019","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"900 8th Avenue, Manhattan, 10019","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"352 Greenwich Street, Manhattan, 10013","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"73-01 37th Avenue, Queens, 11372","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"619 9th Avenue, Manhattan, 10036","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1524 2nd Avenue, Manhattan, 10075","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"500 West 23rd Street, Manhattan, 10011","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"17 John Street, Manhattan, 10038","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"120 Court Street, Brooklyn, 11201","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"1535 2nd Avenue, Manhattan, 10075","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"455 West 37th Street, Manhattan, 10018","vaccines":["Moderna"]},{"name":"Lenox Hill Hospital - Einhorn Auditorium","address":"131 East 76th Street, Manhattan, 10021","vaccines":["Moderna","Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1091 Lexington Avenue, Manhattan, 10075","vaccines":["Moderna"]},{"name":"MiDoctor Urgent Care","address":"715 9th Avenue, Manhattan, 10019","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"721 9th Avenue, Manhattan, 10019","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"95 Wall Street, Manhattan, 10005","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"526 W 30th Street, Manhattan, 10001","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"4 Columbus Circle, Manhattan, 10019","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"72-09 Northern Boulevard, Queens, 11372","vaccines":["Johnson & Johnson"]},{"name":"Sure Drugs","address":"312 Ralph Ave, Brooklyn, 11233","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"296 Flatbush Avenue, Brooklyn, 11217","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"40 Wall Street, Manhattan, 10005","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Elmhurst","address":"79-01 Broadway, Queens, 11373","vaccines":["Pfizer"]},{"name":"Ryan Health - Chelsea Clinton Community Health Center","address":"645 10th Avenue, Manhattan, 10036","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"100 Broadway, Manhattan, 10005","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"401 East 86th Street, Manhattan, 10028","vaccines":["Pfizer"]},{"name":"NYS - Javits Center","address":"429 11th Avenue, Manhattan, 10018","vaccines":["Pfizer","Johnson & Johnson"]},{"name":"Rite Aid Pharmacy","address":"182 Smith Street, Brooklyn, 11201","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"315 N End Ave, Manhattan, 10282","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"8011 Eliot Ave, Queens, 11379","vaccines":["Pfizer"]},{"name":"NYC Health Dept. - Crown Heights Clinic","address":"1218 Prospect Place, Brooklyn, 11213","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"67 Broad Street, Manhattan, 10004","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"305 East 86th Street, Manhattan, 10028","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1889 Broadway, Manhattan, 10023","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1235 Lexington Avenue, Manhattan, 10028","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"37-66 82nd Street, Queens, 11372","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"37 Broadway, Manhattan, 10006","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"225 Liberty Street, Manhattan, 10280","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"82-77 Broadway, Queens, 11373","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1 Whitehall Street, Manhattan, 10004","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1040 St. Johns Place, Brooklyn, 11213","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"82-13 37th Avenue, Queens, 11372","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"84-20 Broadway, Queens, 11373","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"4 Amsterdam Avenue, Manhattan, 10023","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"75-75 31st Avenue, Queens, 11370","vaccines":["Pfizer"]},{"name":"NuCare Pharmacy","address":"1789 1st Avenue, Manhattan, 10128","vaccines":["Johnson & Johnson"]},{"name":"Rite Aid Pharmacy","address":"320 Smith Street, Brooklyn, 11231","vaccines":["Moderna"]},{"name":"Rossi Pharmacy","address":"1891 Eastern Parkway, Brooklyn, 11233","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"43-02 Ditmars Boulevard, Queens, 11105","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1231 Madison Avenue, Manhattan, 10128","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"31-01 Ditmars Boulevard, Queens, 11105","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1675 3rd Avenue, Manhattan, 10128","vaccines":["Pfizer"]},{"name":"Wellness Pharmacy","address":"144 West 72nd Street, Manhattan, 10023","vaccines":["Moderna"]},{"name":"NYS-FEMA Medgar Evers College","address":"231 Crown Street, Brooklyn, 11225","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"85-10 Northern Boulevard, Queens, 11372","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"210 Amsterdam Avenue, Manhattan, 10023","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"7960 Metropolitan Avenue, Queens, 11379","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"1849 2nd Avenue, Manhattan, 10128","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Upper East Side Medical Office","address":"215 East 95th Street, Manhattan, 10128","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2069 Broadway, Manhattan, 10023","vaccines":["Moderna"]},{"name":"NYC Health + Hospitals, Metropolitan","address":"1901 1st Avenue, 4A, Manhattan, 10029","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"1679 Bedford Avenue, Brooklyn, 11225","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"91-08 Roosevelt Avenue, Queens, 11372","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"249 7th Avenue, Brooklyn, 11215","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"380 Amsterdam Avenue, Manhattan, 10024","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - East New York Medical Office","address":"101 Pennsylvania Avenue, Brooklyn, 11207","vaccines":["Moderna"]},{"name":"Apthorp Pharmacy","address":"2191 Broadway, Manhattan, 10024","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"3700-06 Junction Boulevard, Queens, 11368","vaccines":["Moderna"]},{"name":"NYPD Community Center","address":"127 Pennsylvania Avenue, Brooklyn, 11027","vaccines":["Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"462 5th Avenue, Brooklyn, 11215","vaccines":["Pfizer"]},{"name":"COSTCO Pharmacy","address":"61-35 Junction Blvd, Queens, 11374","vaccines":["Moderna"]},{"name":"NYC Health Dept. - Corona Clinic","address":"34-33 Junction Boulevard, Queens, 11372","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"95-11 63rd Drive, Queens, 11374","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"95-14 63rd Drive, Queens, 11374","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"506-528 Utica Avenue, Brooklyn, 11203","vaccines":["Moderna"]},{"name":"Teachers Preparatory High School","address":"226 Bristol Street, Brooklyn, 11212","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"609 Columbus Avenue, Manhattan, 10024","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1490 Madison Avenue, Manhattan, 10029","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1915 3rd Avenue, Manhattan, 10029","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"93-12 Astoria Boulevard, Queens, 11369","vaccines":["Pfizer"]},{"name":"Gotham Health, East New York","address":"2094 Pitkin Avenue, Brooklyn, 11207","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"5822 99th St, Queens, 11368","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Kings County","address":"451 Clarkson Avenue, Brooklyn, 11203","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"700 Columbus Avenue, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Lasante Health Center","address":"672 Parkside Avenue, Second Floor, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"103-14 Roosevelt Avenue, Queens, 11368","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"741 Columbus Avenue, Manhattan, 10025","vaccines":["Moderna"]},{"name":"New Amsterdam Drug Mart Inc.","address":"698 Amsterdam Avenue, Manhattan, 10025","vaccines":["Moderna"]},{"name":"Ryan Health - 97th street","address":"110 West 97th Street, Manhattan, 10025","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"724 Flatbush Avenue, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Mellor's Drug Store","address":"3343 Fulton Ave, Brooklyn, 11208","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Forest Hills Medical Office","address":"96-10 Metropolitan Ave, Queens, 11375","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2522 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"COSTCO Pharmacy","address":"517 East 117th Street, Manhattan, 10035","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"589 Prospect Avenue, Brooklyn, 11215","vaccines":["Pfizer"]},{"name":"NYC Health Dept.- Uptown Clinic","address":"158 East 115th Street, Basement, Manhattan, 10029","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"3000 Church Avenue, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"5001 Church Avenue, Brooklyn, 11203","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"2819 Church Avenue, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"84-32 Jamaica Avenue, Queens, 11421","vaccines":["Pfizer"]},{"name":"Brightpoint Church Avenue Health Center","address":"2412 Church Avenue, Brooklyn, 11226","vaccines":["Moderna","Pfizer"]},{"name":"Walgreens/Duane Reade","address":"63-37 108th Street, Queens, 11375","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2683 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"104-25 Queens Boulevard, Queens, 11375","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"892 Flatbush Avenue, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"The Institute for Family Health, Health Center of Harlem","address":"1824 Madison Avenue, Manhattan, 10035","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"130 Lenox Avenue, Manhattan, 10026","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2760 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"71-14 Austin Street, Queens, 11375","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"135 East 125th Street, Manhattan, 10035","vaccines":["Pfizer"]},{"name":"Gotham Health, Sydenham","address":"264 West 118th Street, Manhattan, 10026","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"2170 Frederick Douglass Boulevard, Manhattan, 10026","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"2833 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"AdvantageCare Physicians - Flatbush Medical Office","address":"1000 Church Avenue, Brooklyn, 11218","vaccines":["Moderna"]},{"name":"BMS Family Health Center at St. Paul Community Baptist Church","address":"859 Hendrix Street, Brooklyn, 11207","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2864 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"35-45 West 125th Street, Manhattan, 10027","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"115 W. 125th Street, Manhattan, 10027","vaccines":["Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"110-88 Queens Boulevard, Queens, 11375","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"4123 Avenue D, Brooklyn, 11203","vaccines":["Pfizer"]},{"name":"COSTCO Pharmacy","address":"976 3rd Ave, Brooklyn, 11232","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1517 Cortelyou Road, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Harlem Medical Office","address":"215 West 125th Street, Manhattan, 10027","vaccines":["Moderna"]},{"name":"Mass Vaccination Site - Citi Field","address":"36-2 126th St, Cars enter through gate 11, Queens, 11368","vaccines":["Pfizer"]},{"name":"Essen Health Care: Metro Urgicare","address":"540 East 138th Street, Bronx, 10454","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1111 Pennsylvania Avenue, Brooklyn, 11207","vaccines":["Pfizer"]},{"name":"Sorin Medical PC","address":"1110 Pennsylvania Avenue, Brooklyn, 11207","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"288 St Nicholas Avenue, Manhattan, 10027","vaccines":["Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"114 Beverley Road, Brooklyn, 11218","vaccines":["Pfizer"]},{"name":"Ryan Health - Frederick Douglass Community Health","address":"2381 Frederick Douglass Boulevard, Manhattan, 10027","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"102-30 Atlantic Avenue, Queens, 11416","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"10204 Flatlands Avenue, Brooklyn, 11236","vaccines":["Pfizer"]},{"name":"Flatbush YMCA","address":"1401 Flatbush Avenue, Brooklyn, 11210","vaccines":["Pfizer"]},{"name":"Gotham Health, Belvis","address":"545 East 142nd Street, Bronx, 10454","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"78-14 Linden Boulevard, Queens, 11414","vaccines":["Pfizer"]},{"name":"Queens Public Library at Ozone Park","address":"92-24 Rockaway Boulevard, Queens, 11417","vaccines":["Pfizer"]},{"name":"Upper Room AIDS Ministry/Harlem United's The Nest Community Health Center","address":"169 W. 133rd Street, Manhattan, 10030","vaccines":["Moderna"]},{"name":"NYC Health + Hospitals, Harlem","address":"506 Lenox Avenue, Manhattan, 10037","vaccines":["Pfizer"]},{"name":"Centers Urgent Care - Gateway Mall","address":"1203 Elton Street, Brooklyn, 11239","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1419 Newkirk Ave, Brooklyn, 11226","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"568 West 125th Street, Manhattan, 10027","vaccines":["Pfizer"]},{"name":"Spring Creek Towers - Cityblock Health","address":"1310 Pennsylvania Avenue, Brooklyn, 11239","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"300 West 135th Street, Manhattan, 10030","vaccines":["Pfizer"]},{"name":"Essen Health Care: Metro Urgicare","address":"2742 Third Avenue, Bronx, 10455","vaccines":["Moderna"]},{"name":"Abyssinian Baptist Church","address":"132 West 138th Street, Manhattan, 10030","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"4901 Kings Highway, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"96-02 Rockaway Blvd, Queens, 11417","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1559 Flatbush Avenue, Brooklyn, 11210","vaccines":["Pfizer"]},{"name":"NYC Vaccine Hub - Canarsie High School","address":"1600 Rockaway Parkway, Brooklyn, 11236","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"1346 Pennsylvania Avenue, Brooklyn, 11239","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"5008 5th Avenue, Brooklyn, 11220","vaccines":["Pfizer"]},{"name":"Sun River Health The Hub","address":"459 East 149th Street, Bronx, 10455","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"282 East 149th Street, Bronx, 10451","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"7812 Flatlands Avenue, Brooklyn, 11236","vaccines":["Moderna"]},{"name":"NYC Health + Hospitals, Lincoln","address":"234 East 149th Street, Room 2A5-250, Bronx, 10451","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"109-07 101st Avenue, Queens, 11419","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - City College of New York - North Academic Center","address":"1549 Amsterdam Ave, Manhattan, 10031","vaccines":["Moderna"]},{"name":"Ramon Valez Health Care Center","address":"754 East 151st Street, 2nd Floor, Bronx, 10455","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"136-02 Roosevelt Avenue, Queens, 11354","vaccines":["Moderna"]},{"name":"RendrCare: Hong Jia Medical","address":"4235 Main Street, #3K, Queens, 11355","vaccines":["Moderna"]},{"name":"Charles B Wang Community Health Center","address":"136-26 37th Avenue, Queens, 11354","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"3387 Broadway, Manhattan, 10031","vaccines":["Pfizer"]},{"name":"NYC Vaccine Hub - South Bronx Educational Campus","address":"701 St Anns Avenue, Bronx, 10455","vaccines":["Moderna"]},{"name":"RendrCare: Helen Chen","address":"136-36 39th Avenue, 5 FL, Queens, 11354","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1791 Utica Avenue, Brooklyn, 11234","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"4714 16th Avenue, Brooklyn, 11204","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1847 Rockaway Parkway, Brooklyn, 11236","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3012 3rd Avenue, Bronx, 10455","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"14-01 College Point Boulevard, Queens, 11356","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"320 West 145th Street, Manhattan, 10039","vaccines":["Pfizer"]},{"name":"RendrCare: Primary Care Medicine Associates","address":"38-08 Union St, 3L, Queens, 11354","vaccines":["Moderna"]},{"name":"Charles B Wang Community Health Center","address":"137-43 45th Avenue, Queens, 11358","vaccines":["Moderna"]},{"name":"Mass Vaccination Site - Brooklyn Army Terminal","address":"140 58th Street, Brooklyn, 11220","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"44-15 Kissena Boulevard, Queens, 11355","vaccines":["Pfizer"]},{"name":"Centers Urgent Care - Flatbush","address":"1811 Avenue J, Brooklyn, 11230","vaccines":["Moderna"]},{"name":"RendrCare: Janlian Medical Group","address":"833 58th Street, Brooklyn, 11220","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"4915 Flatlands Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1409 Avenue J, Brooklyn, 11230","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"132-50 Metropolitan Avenue, Queens, 11418","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"71-18 Kissena Boulevard, Queens, 11367","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"3536 Broadway, Manhattan, 10031","vaccines":["Johnson & Johnson"]},{"name":"Rite Aid Pharmacy","address":"9738 Seaview Avenue, Brooklyn, 11236","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"3539 Broadway, Manhattan, 10031","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"224 East 161st Street, Bronx, 10451","vaccines":["Pfizer"]},{"name":"Bronx Health Collective","address":"871 Prospect Avenue, Bronx, 10459","vaccines":["Moderna"]},{"name":"Bronx Health Collective","address":"890 Prospect Avenue, Bronx, 10459","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"119-10 Liberty Avenue, Queens, 11419","vaccines":["Pfizer"]},{"name":"NYS - Aqueduct Racetrack","address":"110-00 Rockaway Blvd, Racing Hall, Queens, 11420","vaccines":["Pfizer"]},{"name":"Essen Health Care: Metro Urgicare","address":"899 Elton Avenue, Bronx, 10451","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"244 East 161st Street, Bronx, 10451","vaccines":["Pfizer"]},{"name":"Montefiore Comprehensive Health Care Center","address":"305 East 161st street, Bronx, 10451","vaccines":["Moderna"]},{"name":"CPW Pharmacy - Liberty","address":"121-16 Liberty Avenue, Queens, 11419","vaccines":["Johnson & Johnson"]},{"name":"Rite Aid Pharmacy","address":"122-02 Liberty Avenue, Queens, 11419","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"144-29 Northern Boulevard, Queens, 11354","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"2577 Nostrand Avenue, Brooklyn, 11210","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"73-21 Kissena Boulevard, Queens, 11367","vaccines":["Pfizer"]},{"name":"La Casa De Salud, Inc.","address":"966 Prospect Avenue, Bronx, 10459","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"6423 Ft Hamilton Parkway, Brooklyn, 11219","vaccines":["Moderna"]},{"name":"Mass Vaccination Site - Yankee Stadium","address":"1 E 161st Street, Bronx, 10451","vaccines":["Pfizer","Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"2265 Ralph Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"950 Southern Boulevard, Bronx, 10459","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"2320 Ralph Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"160-40 Cross Bay Boulevard, Queens, 11414","vaccines":["Pfizer"]},{"name":"Rambam Family Health Center","address":"1122 Chestnut Ave, Brooklyn, 11230","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"6101 18th Avenue, Brooklyn, 11204","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"90-01 Sutphin Boulevard, Queens, 11435","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"7118 3rd Avenue, Brooklyn, 11209","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"119-02 Rockaway Boulevard, Queens, 11420","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Queens","address":"82-68 164th Street, Queens, 11432","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"5901 Bay Parkway, Brooklyn, 11204","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1033 St. Nicholas Avenue, Manhattan, 10032","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1091 Ogden Avenue, Bronx, 10452","vaccines":["Moderna"]},{"name":"J&N Pharmacy","address":"1220 Morris Avenue, Bronx, 10456","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"7009 13th Avenue, Brooklyn, 11228","vaccines":["Pfizer"]},{"name":"NYC Vaccine Hub - Hillcrest High School","address":"160-05 Highland Avenue, Queens, 11432","vaccines":["Moderna"]},{"name":"Medicine Center Rx LLC","address":"92 East 167th Street, Bronx, 10452","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"6628 18th Avenue, Brooklyn, 11204","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"50 East 167th Street, Bronx, 10452","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"2064 Mill Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2325 Flatbush Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"NYC Health Dept. - Morrisania Clinic","address":"1309 Fulton Avenue, 3rd floor, Bronx, 10456","vaccines":["Moderna"]},{"name":"Gotham Health, Morrisania","address":"1225 Gerard Avenue, 2ND FL RM 2B01, Bronx, 10452","vaccines":["Moderna"]},{"name":"Sutphin Health Center","address":"105-04 Sutphin Blvd, Queens, 11435","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"162-19 Hillside Ave, Queens, 11432","vaccines":["Pfizer"]},{"name":"NorthPoint Medical Associates","address":"1301 Southern Boulevard, 2nd Fl, Bronx, 10459","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"7821 3rd Avenue, Brooklyn, 11209","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"5716 Avenue U, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"159-34 Jamaica Avenue, Queens, 11432","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"925 Soundview Ave, Bronx, 10473","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1720 Kings Highway, Brooklyn, 11229","vaccines":["Pfizer"]},{"name":"Stevenson Family Health Center","address":"731 White Plains Road, Bronx, 10473","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"32 East 170th Street, Bronx, 10452","vaccines":["Pfizer"]},{"name":"New York-Presbyterian Hospital - The Armory","address":"651 W 168th Street, Manhattan, 10032","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"6831 Bay Parkway, Brooklyn, 11204","vaccines":["Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"1612 Westchester Avenue, Bronx, 10472","vaccines":["Moderna"]},{"name":"NYS-FEMA York College","address":"160-02 Liberty Ave, Queens, 11433","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"149-28 14th Avenue, Queens, 11357","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"946 Kings Highway, Brooklyn, 11223","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"436 86th Street, Brooklyn, 11209","vaccines":["Pfizer"]},{"name":"NYC Vaccine Hub - West Bronx Gymnasium","address":"1527 Jesup Avenue, Bronx, 10452","vaccines":["Moderna"]},{"name":"Sun River Health Inwood","address":"1545 Inwood Ave, Bronx, 10452","vaccines":["Moderna"]},{"name":"BronxCare","address":"199 Mt. Eden Avenue, Bronx, 10457","vaccines":["Moderna","Pfizer"]},{"name":"Rite Aid Pharmacy","address":"650 Castle Hill Avenue, Bronx, 10473","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"175-06 Hillside Avenue, Queens, 11432","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"153-45 Cross Island Pkwy, Queens, 11357","vaccines":["Moderna"]},{"name":"Mass Vaccination Site - Bathgate Contract Postal Station","address":"4006 3rd Avenue, Bronx, 10457","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"8222 18th Avenue, Brooklyn, 11214","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"4188 Broadway, Manhattan, 10033","vaccines":["Moderna"]},{"name":"Claremont Family Health Center","address":"262-4 East 174th Street, Bronx, 10457","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1532 86th Street, #34, Brooklyn, 11228","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"20-21 Francis Lewis Boulevard, Queens, 11357","vaccines":["Pfizer"]},{"name":"Metro Community Health Center - Bronx","address":"979 Cross Bronx Expressway, Bronx, 10460","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"178-02 Hillside Avenue, Queens, 11432","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3082 Avenue U, Brooklyn, 11229","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"69-62 188th Street, Queens, 11365","vaccines":["Pfizer"]},{"name":"VIP Community Services","address":"770 East 176th Street, 2nd Floor, Bronx, 10460","vaccines":["Moderna"]},{"name":"Yeshiva University","address":"2495 Amsterdam Avenue, Manhattan, 10033","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"193-01 Northern Boulevard, Queens, 11358","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"9408 3rd Avenue, Brooklyn, 11209","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"186-16 Union Turnpike, Queens, 11366","vaccines":["Pfizer"]},{"name":"Centers Urgent Care - Avenue U","address":"2370 Coney Island Avenue, Brooklyn, 11223","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Jamaica Estates Medical Office","address":"180-05 Hillside Ave, Queens, 11432","vaccines":["Moderna"]},{"name":"Mass Vaccination Site - Empire Outlets","address":"55 Richmond Terrace, Staten Island, 10301","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"35-26 Francis Lewis Boulevard, Queens, 11358","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"1510 St. Nicholas Avenue, Manhattan, 10033","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"650 East Tremont Avenue, Bronx, 10457","vaccines":["Pfizer"]},{"name":"Walton Family Health Center","address":"1894 Walton Avenue, Bronx, 10453","vaccines":["Moderna"]},{"name":"86 BoBo Pharmacy Inc.","address":"2170 86th Street, Brooklyn, 11214","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1371 Metropolitan Avenue, Bronx, 10462","vaccines":["Moderna"]},{"name":"Bay Street Health Center","address":"57 Bay Street, Staten Island, 10301","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"19-23 Utopia Parkway, Queens, 11357","vaccines":["Moderna"]},{"name":"RendrCare: Metro True Care Medical","address":"8686 Bay Pkwy, Suite M1, Brooklyn, 11214","vaccines":["Moderna"]},{"name":"Korean Community Services","address":"203-05 32nd Avenue, Queens, 11361","vaccines":["Pfizer"]},{"name":"Union Community Health Center - Grand Concourse","address":"2021 Grand Concourse, Bronx, 10453","vaccines":["Pfizer"]},{"name":"Montefiore Castle Hill Family Practice","address":"2175 Westchester Avenue, Bronx, 10462","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2532 86th Street, #54, Brooklyn, 11214","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2590 Coney Island Avenue, Brooklyn, 11223","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"57 East Burnside Avenue, Bronx, 10453","vaccines":["Moderna"]},{"name":"Morris Heights Health Center - 85 Burnside","address":"85 West Burnside Avenue, Bronx, 10453","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"115-10 Merrick Boulevard, Queens, 11434","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"3823 Nostrand Avenue, Brooklyn, 11235","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - August Martin High School","address":"156-10 Baisley Boulevard, Queens, 11434","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"592 East 183rd Street, Bronx, 10458","vaccines":["Moderna"]},{"name":"Stop & Shop #505","address":"1710 Avenue Y, Brooklyn, 11235","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"344 Avenue X, Brooklyn, 11223","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"165-02 Baisley Boulevard, Queens, 11434","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"127-04 Guy R Brewer Boulevard, Queens, 11434","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"1402 Sheepshead Bay Road, Brooklyn, 11235","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"130 Dyckman Street, Manhattan, 10040","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"911 Morris Park Avenue, Bronx, 10462","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"133 Dyckman Street, Manhattan, 10040","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"39-20 Bell Boulevard, Queens, 11361","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"3775 East Tremont Avenue, Bronx, 10465","vaccines":["Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"3590 East Tremont Avenue, Bronx, 10465","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"43-20 Bell Boulevard, Queens, 11361","vaccines":["Moderna"]},{"name":"NYC Health + Hospitals, Coney Island","address":"2601 Ocean Parkway, Main building, 2nd floor conference room, Brooklyn, 11235","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"2748 East Tremont Avenue, Bronx, 10461","vaccines":["Moderna"]},{"name":"Union Community Health Center - 188th Street","address":"260 East 188th Street, Bronx, 10458","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"55 Westchester Square, Bronx, 10461","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"24-28 Bell Boulevard, Queens, 11360","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"58 East Fordham Road, Bronx, 10468","vaccines":["Pfizer"]},{"name":"Montefiore Family Health Center","address":"1 Fordham Plaza, 5th Floor, Bronx, 10458","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"3085 East Tremont Avenue, Bronx, 10461","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"49 West Fordham Road, Bronx, 10468","vaccines":["Pfizer"]},{"name":"Franhill Pharmacy","address":"204-19 Hillside Avenue, Queens, 11423","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"406 East Fordham Road, Bronx, 10458","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Abraham Lincoln High School","address":"2800 Ocean Parkway, Brooklyn, 11235","vaccines":["Moderna"]},{"name":"Montefiore Comprehensive Family Care Center","address":"1621 Eastchester Road, Bronx, 10461","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"4910 Broadway, Manhattan, 10034","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2158 White Plains Rd, Bronx, 10462","vaccines":["Moderna"]},{"name":"Gotham Health, Vanderbilt","address":"165 Vanderbilt Avenue, 2nd Floor, Staten Island, 10304","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"215-08 73rd Avenue, Windsor Park S/C, Queens, 11364","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1820 Williamsbridge Road, Bronx, 10461","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"532 Neptune Avenue, Brooklyn, 11224","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"713 Brighton Beach Avenue, Brooklyn, 11235","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"61-29 Springfield Blvd, Queens, 11364","vaccines":["Pfizer"]},{"name":"Centers Urgent Care - Coney Island","address":"626 Sheepsheadbay Road, Brooklyn, 11224","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"105 Brighton Beach Avenue, Brooklyn, 11235","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1710 Crosby Avenue, Bronx, 10461","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2431 Boston Road, Bronx, 10467","vaccines":["Moderna"]},{"name":"Richmond University Medical Center","address":"355 Bard Ave, Staten Island, 10310","vaccines":["Moderna","Pfizer"]},{"name":"Walgreens/Duane Reade","address":"109-62 Francis Lewis Boulevard, Queens, 11429","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Jacobi","address":"1400 Pelham Parkway South, Bronx, 10461","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"3001 Mermaid Avenue, Brooklyn, 11224","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"219-39 89th Avenue, Queens, 11427","vaccines":["Johnson & Johnson"]},{"name":"Rite Aid Pharmacy","address":"21b Knolls Crescent, Bronx, 10463","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2750 Boston Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"Bakers Drugs","address":"205-43 Linden Boulevard, Queens, 11412","vaccines":["Moderna"]},{"name":"Montefiore Marble Hill Family Practice","address":"5525 Broadway, Ground Floor, Bronx, 10463","vaccines":["Moderna"]},{"name":"Coney Island YMCA","address":"2980 West 29th Street, Brooklyn, 11224","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"206-09 Linden Boulevard, Queens, 11411","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"3681 Bruckner Boulevard, Bronx, 10461","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"5564 Broadway, Bronx, 10463","vaccines":["Pfizer"]},{"name":"AdvantageCare Physicians - Cambria Heights Medical Office","address":"206-20 Linden Boulevard, Queens, 11411","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"219-14 Merrick Boulevard, Queens, 11413","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"3125 Bainbridge Avenue, Bronx, 10467","vaccines":["Pfizer"]},{"name":"HSS - Martin Van Buren HS","address":"230-17 Hillside Avenue, Queens, 11427","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2504 Eastchester Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Bronx High School of Science","address":"75 West 205th Street, Bronx, 10468","vaccines":["Moderna"]},{"name":"Montefiore Williamsbridge Family Practice","address":"3011 Boston Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"218-35 Hempstead Avenue, Queens, 11429","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Clove Road Medical Office","address":"1050 Clove Road, Staten Island, 10301","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2270 Clove Road, Staten Island, 10305","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"222-14 Linden Boulevard, Queens, 11411","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"541 West 235th Street, Bronx, 10463","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, North Central Bronx","address":"3424 Kossuth Avenue, Bronx, 10467","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"5825-35 Broadway, Bronx, 10463","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3480 Jerome Avenue, Bronx, 10467","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"116-02 Beach Channel Drive, Queens, 11694","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3040 Eastchester Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"1361 Hylan Boulevard, Staten Island, 10305","vaccines":["Johnson & Johnson"]},{"name":"NYC Vaccine Hub - Beach Channel Educational Campus","address":"100-00 Beach Channel Drive, Queens, 11694","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"106-40 Rockaway Beach Boulevard, Queens, 11694","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"249-46 Horace Harding Expressway, Queens, 11362","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1227 Forest Avenue, Staten Island, 10310","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"88-07 Rockaway Beach Boulevard, Queens, 11693","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3575 Boston Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Ocean Breeze Athletic Complex","address":"625 Father Capodanno Blvd, Staten Island, 10305","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"245-14 Francis Lewis Boulevard, Queens, 11422","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Port Richmond H.S.","address":"85 St. Joseph's Avenue, Staten Island, 10302","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"3901 White Plains Road, Bronx, 10466","vaccines":["Moderna"]},{"name":"Bronx Co-Op City Dreiser Community Center","address":"177 Dreiser Loop, Bronx, 10475","vaccines":["Johnson & Johnson"]},{"name":"Walgreens/Duane Reade","address":"1759 Hylan Boulevard, Staten Island, 10305","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"1571 Forest Avenue, Staten Island, 10302","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"255-01 Union Turnpike, Queens, 11004","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"1933 Victory Boulevard, Staten Island, 10314","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"251-21 Jamaica Ave, Queens, 11426","vaccines":["Pfizer"]},{"name":"NYS - Bay Eden Senior Center","address":"1220 East 229th Street, Bronx, 10466","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"955 Manor Road, Staten Island, 10314","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"691 Co-Op City Boulevard, Bronx, 10475","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1179 East 233rd Street, Bronx, 10466","vaccines":["Pfizer"]},{"name":"Top Value Pharmacy & Compounding","address":"3811 Dyre Avenue, Bronx, 10466","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"2045 Forest Avenue, Staten Island, 10303","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"4232 Baychester Ave, Bronx, 10466","vaccines":["Moderna"]},{"name":"Beacon Christian Community Health Center","address":"2079 Forest Avenue, Staten Island, 10303","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Rockaway Medical Office","address":"29-15 Far Rockaway Boulevard, Queens, 11691","vaccines":["Moderna"]},{"name":"Metro Community Health Center - Staten Island","address":"2324 Forest Avenue, Staten Island, 10303","vaccines":["Moderna"]},{"name":"Ocean Park Drugs","address":"17-27 Seagirt Boulevard, Queens, 11691","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1551 Richmond Avenue, Staten Island, 10314","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"2690 Hylan Boulevard, Staten Island, 10306","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3155 Amboy Road, Staten Island, 10306","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"2465 Richmond Avenue, Staten Island, 10314","vaccines":["Pfizer"]},{"name":"COSTCO Pharmacy","address":"2975 Richmond Ave, Staten Island, 10314","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"640 Arthur Kill Road, Staten Island, 10308","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"758 Arthur Kill Road, Staten Island, 10312","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"4065 Amboy Road, Staten Island, 10308","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"43-68 Amboy Road, Staten Island, 10312","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Annandale Medical Office","address":"4771 Hylan Boulevard, Staten Island, 10312","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"655 Rossville Avenue, Staten Island, 10309","vaccines":["Moderna"]},{"name":"St. Joseph - St. Thomas Parish","address":"50 Maguire Avenue, Staten Island, 10309","vaccines":["Pfizer"]},{"name":"Super Health Pharmacy","address":"6400 Amboy Road, Staten Island, 10309","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"7001 Amboy Road, Staten Island, 10307","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"250 Page Avenue, Staten Island, 10307","vaccines":["Pfizer"]}]`);

  // shorthand`
  selector = tpl.selector;

  tpl.initialize();

  window.butler = tpl;

})();
