(function() {

  // allow error reporting
  window.onerror = null;

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

    // template code defined at bottom

    settingsModal,
    completedModal,

    html,
    css,

    // json of locations (loaded at end of file)
    locations,

    // shorthand
    selector,
    settings,

    tpl
  ;

  tpl = {

    // whether to log behavior to console
    debug         : true,

    reloadDelay   : 10,

    // for tracking metrics
    startTime     : false,
    lastQueryTime : false,

    // whether to use interval or mutation observers
    useInterval   : true,

    queryInterval : 1500,
    checkInterval : 1000,

    // used for confetti animation
    lastRequestID: false,
    confettiColors: [
      [255, 207, 207], // pink
      [31, 41, 112], // purple
      [13, 80, 171], // blue
      [177, 227, 241], // light blue
      [255, 255, 255] // white
    ],

    // maximum edit distance for location to be considered same
    maxEditDistance: 0,

    defaults: {
      zipcode  : 11222,
      borough  : 'Brooklyn',
      maxMiles : 100,
      minHour  : 0,
      maxHour  : 24,
      vaccines : ['Moderna'],
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

      if(window.butler) {
        window.butler.destroy();
      }

      tpl.setup.styles();
      tpl.setup.html();
      tpl.setup.events();

      tpl.show.completedModal();
      //tpl.show.settingsModal();

    },

    start(settings = tpl.defaults) {
      tpl.startTime = new Date();

      // NOTE
      // it appears something is preventing MutationObservers from reporting (maybe Recaptcha)
      // A more brutish method with interval is necessary to handle refresh
      if(tpl.useInterval) {
        let poll = function() {
          tpl.set.zipcodeQuery();
          setTimeout(tpl.event.documentChanged, tpl.checkInterval);
        };
        poll();
        tpl.interval = setInterval(poll, tpl.queryInterval);
      }
      else {
        tpl.set.zipcodeQuery();
        tpl.bind.documentObserver();
      }

    },

    destroy() {
      tpl.log('Tearing down butler');
      if(tpl.observer) {
        tpl.observer.disconnect();
      }
      if(tpl.interval) {
        clearInterval(tpl.interval);
      }
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
          settingsSubmitEl  = document.querySelectorAll('settingsModal submit.button')[0],
          settingsCancelEl  = document.querySelectorAll('settingsModal cancel.button')[0],
          completedSubmitEl = document.querySelectorAll('completedModal submit.button')[0],
          completedCancelEl = document.querySelectorAll('completedModal cancel.button')[0]
        ;
        settingsSubmitEl.addEventListener('click', tpl.event.submitSettingsClick);
        settingsCancelEl.addEventListener('click', tpl.event.cancelSettingsClick);
        completedSubmitEl.addEventListener('click', tpl.event.completedSubmitClick);
        completedCancelEl.addEventListener('click', tpl.event.completedCancelClick);
      },
    },

    get: {

      locationInfo(location) {
        let match;
        if(typeof location !== 'object') {
          return;
        }
        if(location.name) {
          match = tpl.get.location(location.name);
        }
        if(!match && location.address) {
          match = tpl.get.location(location.address);
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
        return location;
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
            locationInfo,
            appointmentData
          ;

          // check constraints
          if(typeof settings.borough == 'string' && settings.borough !== 'Any' && borough.toLowerCase() != settings.borough.toLowerCase()) {
            isMatch = false;
            console.log('incorrect borough', name, borough);
          }
          if(typeof settings.maxMiles == 'number' && miles > settings.maxMiles) {
            console.log('exceeds max miles', name, miles);
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
            if(time.hours > settings.minHour && time.hours < settings.maxHour) {
              if(isMatch) {
                matchingTimes.push(time);
              }
            }
            else {
              console.log('Appointment time outside range', name, timeText);
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

          locationInfo = tpl.get.locationInfo(appointmentData);
          if(locationInfo.vaccines) {
            appointmentData.vaccines = locationInfo.vaccines;
          }
          if(locationInfo.phone) {
            appointmentData.phone = locationInfo.phone;
          }

          appointments.push(appointmentData);
        }
        return appointments;
      },

      randomElement(arrayItems) {
        return arrayItems[Math.floor(Math.random() * arrayItems.length)];
      },

    },

    set: {
      userSettings(userSettings) {
        Object.assign(tpl.settings, tpl.defaults, userSettings);

        // shorthand
        settings = tpl.settings;
      },
      zipcodeQuery() {
        tpl.lastQueryTime = performance.now();
        let searchEl = $(selector.searchInput)[0];
        if(searchEl) {
          searchEl.value = null;
          searchEl.value = settings.zipcode;
        }
      },
      defaultSettings() {
        let
          existingZipcode = $(selector.searchInput)[0].value,
          zipcodeEl = document.querySelectorAll('settingsModal input[name="zipcode"]')[0]
        ;
        if(existingZipcode) {
          zipcodeEl.value = existingZipcode;
        }
      }
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
      modal(selector) {
        let
          dimmerEl = document.querySelectorAll('contentInject .dimmer')[0],
          modalEl  = dimmerEl.querySelectorAll(selector)[0]
        ;
        dimmerEl.classList.add('visible');
        modalEl.classList.add('visible');
      },
      confetti() {
        let
          dimmerEl = document.querySelectorAll('contentInject .dimmer'),
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
        if(tpl.interval) {
          clearInterval(tpl.interval);
        }
        tpl.show.modal('completedModal');
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
      confetti() {
        let
          canvas = document.querySelectorAll('contentInject canvas')[0]
        ;
        cancelAnimationFrame(tpl.lastRequestID);
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

        xpos = 0.5;
        ypos = 0.5;
        /*
        $(document).on('mousemove.confetti', function(e) {
          xpos = e.pageX / w;
          ypos = e.pageY / h;
        });
        */

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

        window.step = function() {
          let c, j, len, results;
          tpl.lastRequestID = requestAnimationFrame(step);
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


    event: {
      documentChanged(mutations) {

        if(tpl.useInterval) {
          tpl.log('Interval fired');
        }
        else {
          tpl.log('Mutations detected', mutations);
        }

        let
          searchAgain = function() {
            // interval will handle searching again
            // unless we are using mutation observers
            if(!tpl.useInterval) {
              tpl.log('Triggering new search');
              setTimeout(tpl.set.zipcodeQuery, tpl.reloadDelay);
            }
          }
        ;

        // results are loading still
        if($(selector.loader).length > 0) {
          tpl.log('A) Loader detected');
          return;
        }

        // no results found
        else if($(selector.noResults).length > 0) {
          tpl.log('B) No results detected');
          tpl.results.push({
            completed     : new Date(),
            executionTime : performance.now() - tpl.lastQueryTime,
            appointments  : []
          });
          searchAgain();
          return;
        }

        // check if new page content is in the DOM
        else if($(selector.appointment).length > 0) {
          let
            appointments = tpl.get.appointmentList(),
            hasMatching  = false
          ;
          tpl.log('C) Appointments Found');
          tpl.log(appointments);
          tpl.results.push({
            completed     : new Date(),
            executionTime : performance.now() - tpl.lastQueryTime,
            appointments  : appointments
          });
          // select first matching appointment
          for(let index=0; index < appointments.length; index++) {
            let appointment = appointments[index];
            if(appointment.matchingTimes.length) {
              let time = tpl.get.randomElement(appointment.matchingTimes);
              tpl.log('Matching appointment found', appointment);
              tpl.select.appointmentTime(time.element);
              hasMatching = true;
              return;
            }
            else {
              tpl.log('No matching appointments found', appointments);
            }
          }
          searchAgain();
        }

        else if($(selector.patientInfo).length > 0) {
          tpl.log('d) appointment selected. patient info screen');
          tpl.show.successModal();
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
              if(['maxMiles', 'minHour', 'maxHour'].includes(name)) {
                value = Number(value);
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
      cancelSettingsClick(event) {
        tpl.hide.modal();
      },
      completedSubmitClick(event) {
      },
      completedCancelClick(event) {
        tpl.hide.modal();
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
    contentInject .header {
      font-family: 'Cormorant Garamond';
    }
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
    contentInject .dimmer .confetti {
      position: absolute;
      width: 100%;
      height: 100%;
    }
    contentInject .dimmer.visible {
      pointer-events: auto;
      opacity: 1;
    }
    contentInject .button {
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

    contentInject .grid {
      display: flex;
      flex-direction: row;
    }
    contentInject .grid > .column {
      flex-grow: 1;
      width: 50%;
    }
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
              <input name="maxMiles" value="20" type="text">
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
          <p>Limit locations to only those offering:</p>
          <div class="fields">
            <div class="field">
              <label>Pfizer (High Efficacy)</label>
              <input name="vaccines[]" value="Pfizer" type="checkbox" checked>
            </div>
            <div class="field">
              <label>Moderna (High Efficacy)</label>
              <input name="vaccines[]" value="Johnson & Johnson" type="checkbox" checked>
            </div>
            <div class="field">
              <label>Johnson & Johnson (Single Dose)</label>
              <input name="vaccines[]" value="Moderna" type="checkbox" checked>
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
                  <td class="distance">
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
                  <td class="criteria">
                    Criteria
                  </td>
                  <td>
                  </td>
                </tr>
                <tr>
                  <td class="totalTime">
                    Total Time
                  </td>
                  <td>
                  </td>
                </tr>
                <tr>
                  <td class="searchCount">
                    Searches Made
                  </td>
                  <td>
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
                  <td class="appointmentCount">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="actions">
        <cancel class="button">
          Restart Search
        </cancel>
        <submit class="primary button">
          Continue
        </submit>
      </div>
    </completedModal>
  `;

  html = `
    <div class="dimmer">
      ${settingsModal}
      ${completedModal}
    </div>
  `;


  // needs to be updated manually to stay up to date
  // found in locations.json
  locations = JSON.parse(`[{"name":"RendrCare: Metro True Care Medical","address":"8686 Bay Pkwy, Suite M1, Brooklyn, 11214","vaccines":["Moderna"]},{"name":"RendrCare: Chinatown Medical Physician","address":"86 Bowery, 4 Floor, Manhattan, 10013","vaccines":["Moderna"]},{"name":"Gotham Health, Cumberland","address":"100 North Portland Avenue, Brooklyn, 11205","vaccines":["Moderna"]},{"name":"NYC Health Dept. - Fort Greene Clinic","address":"295 Flatbush Ave, 5th floor, Brooklyn, 11201","vaccines":["Moderna"]},{"name":"MiDoctor Urgent Care","address":"715 9th Avenue, Manhattan, 10019","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - East New York Medical Office","address":"101 Pennsylvania Avenue, Brooklyn, 11207","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Bushwick Educational Campus","address":"400 Irving Avenue, Brooklyn, 11237","vaccines":["Moderna"]},{"name":"Sun River Health The Hub","address":"459 East 149th Street, Bronx, 10455","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Downtown Medical Office","address":"447 Atlantic Avenue, Brooklyn, 11217","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Flatiron District Medical Office","address":"21 East 22nd Street, Manhattan, 10010","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Harlem Medical Office","address":"215 West 125th Street, Manhattan, 10027","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Flatbush Medical Office","address":"1000 Church Avenue, Brooklyn, 11218","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Annandale Medical Office","address":"4771 Hylan Boulevard, Staten Island, 10312","vaccines":["Moderna"]},{"name":"Essen Health Care: Metro Urgicare","address":"899 Elton Avenue, Bronx, 10451","vaccines":["Moderna"]},{"name":"Sutphin Health Center","address":"105-04 Sutphin Blvd, Queens, 11435","vaccines":["Moderna"]},{"name":"Essen Health Care: Metro Urgicare","address":"540 East 138th Street, Bronx, 10454","vaccines":["Moderna"]},{"name":"Sun River Health Inwood","address":"1545 Inwood Ave, Bronx, 10452","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Jamaica Estates Medical Office","address":"180-05 Hillside Ave, Queens, 11432","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Hillcrest High School","address":"160-05 Highland Avenue, Queens, 11432","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - South Bronx Educational Campus","address":"701 St Anns Avenue, Bronx, 10455","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Forest Hills Medical Office","address":"96-10 Metropolitan Ave, Queens, 11375","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Rockaway Medical Office","address":"29-15 Far Rockaway Boulevard, Queens, 11691","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Clove Road Medical Office","address":"1050 Clove Road, Staten Island, 10301","vaccines":["Moderna"]},{"name":"ODA Primary Healthcare Network","address":"74 Wallabout Street, Brooklyn, 11249","vaccines":["Moderna"]},{"name":"NYC Health Dept. - Downtown Clinic","address":"125 Worth Street, Manhattan, 10013","vaccines":["Moderna"]},{"name":"Lasante Health Center","address":"672 Parkside Avenue, Second Floor, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Ryan Health - Chelsea Clinton Community Health Center","address":"645 10th Avenue, Manhattan, 10036","vaccines":["Moderna"]},{"name":"NYC Health Dept.- Uptown Clinic","address":"158 East 115th Street, Basement, Manhattan, 10029","vaccines":["Moderna"]},{"name":"RendrCare: Helen Chen","address":"136-36 39th Avenue, 5 FL, Queens, 11354","vaccines":["Moderna"]},{"name":"RendrCare: Primary Care Medicine Associates","address":"38-08 Union St, 3L, Queens, 11354","vaccines":["Moderna"]},{"name":"RendrCare: Hong Jia Medical","address":"4235 Main Street, #3K, Queens, 11355","vaccines":["Moderna"]},{"name":"Gotham Health, Vanderbilt","address":"165 Vanderbilt Avenue, 2nd Floor, Staten Island, 10304","vaccines":["Moderna"]},{"name":"Gotham Health, Morrisania","address":"1225 Gerard Avenue, 2ND FL RM 2B01, Bronx, 10452","vaccines":["Moderna"]},{"name":"Beacon Christian Community Health Center","address":"2079 Forest Avenue, Staten Island, 10303","vaccines":["Moderna"]},{"name":"RendrCare: Janlian Medical Group","address":"833 58th Street, Brooklyn, 11220","vaccines":["Moderna"]},{"name":"Gotham Health, East New York","address":"2094 Pitkin Avenue, Brooklyn, 11207","vaccines":["Moderna"]},{"name":"Gotham Health, Belvis","address":"545 East 142nd Street, Bronx, 10454","vaccines":["Moderna"]},{"name":"Gotham Health, Gouverneur","address":"227 Madison Street, Manhattan, 10002","vaccines":["Moderna"]},{"name":"COSTCO Pharmacy","address":"2975 Richmond Ave, Staten Island, 10314","vaccines":["Moderna"]},{"name":"COSTCO Pharmacy","address":"32-50 Vernon Boulevard, Queens, 11106","vaccines":["Moderna"]},{"name":"Montefiore Family Health Center","address":"1 Fordham Plaza, 5th Floor, Bronx, 10458","vaccines":["Moderna"]},{"name":"Bronx Health Collective","address":"890 Prospect Avenue, Bronx, 10459","vaccines":["Moderna"]},{"name":"Metro Community Health Center - Bronx","address":"979 Cross Bronx Expressway, Bronx, 10460","vaccines":["Moderna"]},{"name":"Bronx Health Collective","address":"871 Prospect Avenue, Bronx, 10459","vaccines":["Moderna"]},{"name":"Montefiore Marble Hill Family Practice","address":"5525 Broadway, Ground Floor, Bronx, 10463","vaccines":["Moderna"]},{"name":"Montefiore Comprehensive Family Care Center","address":"1621 Eastchester Road, Bronx, 10461","vaccines":["Moderna"]},{"name":"Montefiore Comprehensive Health Care Center","address":"305 East 161st street, Bronx, 10451","vaccines":["Moderna"]},{"name":"Morris Heights Health Center - 85 Burnside","address":"85 West Burnside Avenue, Bronx, 10453","vaccines":["Moderna"]},{"name":"Bay Street Health Center","address":"57 Bay Street, Staten Island, 10301","vaccines":["Moderna"]},{"name":"Montefiore Williamsbridge Family Practice","address":"3011 Boston Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"Charles B Wang Community Health Center","address":"136-26 37th Avenue, Queens, 11354","vaccines":["Moderna"]},{"name":"Charles B Wang Community Health Center","address":"268 Canal Street, Manhattan, 10013","vaccines":["Moderna"]},{"name":"COSTCO Pharmacy","address":"976 3rd Ave, Brooklyn, 11232","vaccines":["Moderna"]},{"name":"RendrCare: Metro True Care Medical","address":"139 Centre Street, #709, Manhattan, 10013","vaccines":["Moderna"]},{"name":"Mass Vaccination Site - Bathgate Contract Postal Station","address":"4006 3rd Avenue, Bronx, 10457","vaccines":["Moderna"]},{"name":"Mass Vaccination Site - Brooklyn Army Terminal","address":"140 58th Street, Brooklyn, 11220","vaccines":["Moderna"]},{"name":"NYC Health Dept. - Corona Clinic","address":"34-33 Junction Boulevard, Queens, 11372","vaccines":["Moderna"]},{"name":"NYC Health Dept. - Crown Heights Clinic","address":"1218 Prospect Place, Brooklyn, 11213","vaccines":["Moderna"]},{"name":"Walton Family Health Center","address":"1894 Walton Avenue, Bronx, 10453","vaccines":["Moderna"]},{"name":"The Institute for Family Health, Health Center of Harlem","address":"1824 Madison Avenue, Manhattan, 10035","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"43-68 Amboy Road, Staten Island, 10312","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Abraham Lincoln High School","address":"2800 Ocean Parkway, Brooklyn, 11235","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Canarsie High School","address":"1600 Rockaway Parkway, Brooklyn, 11236","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - August Martin High School","address":"156-10 Baisley Boulevard, Queens, 11434","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Beach Channel Educational Campus","address":"100-00 Beach Channel Drive, Queens, 11694","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Long Island City","address":"5-17 46th Road, Queens, 11101","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Port Richmond H.S.","address":"85 St. Joseph's Avenue, Staten Island, 10302","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Ocean Breeze Athletic Complex","address":"625 Father Capodanno Blvd, Staten Island, 10305","vaccines":["Moderna"]},{"name":"NYC Health + Hospitals, Jacobi","address":"1400 Pelham Parkway South, Bronx, 10461","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Lincoln","address":"234 East 149th Street, Room 2A5-250, Bronx, 10451","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, North Central Bronx","address":"3424 Kossuth Avenue, Bronx, 10467","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Bellevue","address":"462 1st Avenue, Manhattan, 10016","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Harlem","address":"506 Lenox Avenue, Manhattan, 10037","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Metropolitan","address":"1901 1st Avenue, 4A, Manhattan, 10029","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Elmhurst","address":"79-01 Broadway, Queens, 11373","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Coney Island","address":"2601 Ocean Parkway, Main building, 2nd floor conference room, Brooklyn, 11235","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Kings County","address":"451 Clarkson Avenue, Brooklyn, 11203","vaccines":["Pfizer"]},{"name":"NYC Health + Hospitals, Woodhull","address":"760 Broadway, Brooklyn, 11206","vaccines":["Pfizer"]},{"name":"Gotham Health, Sydenham","address":"264 West 118th Street, Manhattan, 10026","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Upper East Side Medical Office","address":"215 East 95th Street, Manhattan, 10128","vaccines":["Moderna"]},{"name":"Rambam Family Health Center","address":"1122 Chestnut Ave, Brooklyn, 11230","vaccines":["Moderna"]},{"name":"AdvantageCare Physicians - Cambria Heights Medical Office","address":"206-20 Linden Boulevard, Queens, 11411","vaccines":["Moderna"]},{"name":"NYC Health Dept. - Morrisania Clinic","address":"1309 Fulton Avenue, 3rd floor, Bronx, 10456","vaccines":["Moderna"]},{"name":"Stevenson Family Health Center","address":"731 White Plains Road, Bronx, 10473","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"592 East 183rd Street, Bronx, 10458","vaccines":["Moderna"]},{"name":"Lenox Hill Hospital - Einhorn Auditorium","address":"131 East 76th Street, Manhattan, 10021","vaccines":["Moderna","Pfizer"]},{"name":"Rite Aid Pharmacy","address":"35-45 West 125th Street, Manhattan, 10027","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"82-13 37th Avenue, Queens, 11372","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"8222 18th Avenue, Brooklyn, 11214","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"2577 Nostrand Avenue, Brooklyn, 11210","vaccines":["Moderna"]},{"name":"VIP Community Services","address":"770 East 176th Street, 2nd Floor, Bronx, 10460","vaccines":["Moderna"]},{"name":"Ryan Health - Nena Community Health Center","address":"279 East 3rd Street, Manhattan, 10009","vaccines":["Moderna"]},{"name":"Ryan Health - Frederick Douglass Community Health","address":"2381 Frederick Douglass Boulevard, Manhattan, 10027","vaccines":["Moderna"]},{"name":"Charles B Wang Community Health Center","address":"137-43 45th Avenue, Queens, 11358","vaccines":["Moderna"]},{"name":"Ryan Health - 97th street","address":"110 West 97th Street, Manhattan, 10025","vaccines":["Moderna"]},{"name":"Montefiore Castle Hill Family Practice","address":"2175 Westchester Avenue, Bronx, 10462","vaccines":["Moderna"]},{"name":"NYC Health Dept. - Elmhurst Clinic","address":"48-01 90th Street, Queens, 11373","vaccines":["Moderna"]},{"name":"NYS - Javits Center","address":"429 11th Avenue, Manhattan, 10018","vaccines":["Pfizer","Johnson & Johnson"]},{"name":"Metro Community Health Center - Staten Island","address":"2324 Forest Avenue, Staten Island, 10303","vaccines":["Moderna"]},{"name":"BronxCare","address":"199 Mt. Eden Avenue, Bronx, 10457","vaccines":["Moderna","Pfizer"]},{"name":"La Casa De Salud, Inc.","address":"966 Prospect Avenue, Bronx, 10459","vaccines":["Moderna"]},{"name":"Claremont Family Health Center","address":"262-4 East 174th Street, Bronx, 10457","vaccines":["Moderna"]},{"name":"Upper Room AIDS Ministry/Harlem United's The Nest Community Health Center","address":"169 W. 133rd Street, Manhattan, 10030","vaccines":["Moderna"]},{"name":"Ramon Valez Health Care Center","address":"754 East 151st Street, 2nd Floor, Bronx, 10455","vaccines":["Moderna"]},{"name":"Apicha Primary Care Clinic","address":"400 Broadway, Manhattan, 10013","vaccines":["Moderna"]},{"name":"Essen Health Care: Metro Urgicare","address":"2742 Third Avenue, Bronx, 10455","vaccines":["Moderna"]},{"name":"Hospital for Special Surgery","address":"525 East 71st Street, Belaire building (courtyard and ground floor), Manhattan, 10021","vaccines":["Pfizer"]},{"name":"NYS - Aqueduct Racetrack","address":"110-00 Rockaway Blvd, Racing Hall, Queens, 11420","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2 Penn Plaza, Manhattan, 10121","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"60-36 Myrtle Avenue, Queens, 11385","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"32-87 Steinway Street, Queens, 11103","vaccines":["Moderna"]},{"name":"COSTCO Pharmacy","address":"517 East 117th Street, Manhattan, 10035","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"133 Dyckman Street, Manhattan, 10040","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2683 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"244 East 161st Street, Bronx, 10451","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"7001 Amboy Road, Staten Island, 10307","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"100 Delancey Street, Manhattan, 10002","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"100 West 57th Street, Manhattan, 10019","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"105 Brighton Beach Avenue, Brooklyn, 11235","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1052 1st Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1091 Lexington Avenue, Manhattan, 10075","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1111 3rd Avenue, Manhattan, 10065","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"116-02 Beach Channel Drive, Queens, 11694","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1191 2nd Avenue, Manhattan, 10065","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"122 East 42nd Street, Manhattan, 10168","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1231 Madison Avenue, Manhattan, 10128","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1235 Lexington Avenue, Manhattan, 10028","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"135 East 125th Street, Manhattan, 10035","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1352 1st Avenue, Manhattan, 10021","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"136-02 Roosevelt Avenue, Queens, 11354","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1490 Madison Avenue, Manhattan, 10029","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1498 York Avenue, Manhattan, 10075","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1524 2nd Avenue, Manhattan, 10075","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"155 East 34th Street, Manhattan, 10016","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"164 Kent Avenue, Brooklyn, 11249","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1675 3rd Avenue, Manhattan, 10128","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"180 West 20th Street, Manhattan, 10011","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1889 Broadway, Manhattan, 10023","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1915 3rd Avenue, Manhattan, 10029","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"194 East 2nd Street, Manhattan, 10009","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"200 Water Street, Manhattan, 10038","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2069 Broadway, Manhattan, 10023","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2265 Ralph Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"24-28 Bell Boulevard, Queens, 11360","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"249-46 Horace Harding Expressway, Queens, 11362","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"250 Bedford Avenue, Brooklyn, 11249","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"250 Broadway, Manhattan, 10007","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2522 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2760 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"28-58 Steinway Street, Queens, 11103","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2864 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"296 Flatbush Avenue, Brooklyn, 11217","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"300 East 39th Street, Manhattan, 10016","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"300 West 135th Street, Manhattan, 10030","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"320 West 145th Street, Manhattan, 10039","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3387 Broadway, Manhattan, 10031","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"35-06 Broadway, Queens, 11106","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"352 Greenwich Street, Manhattan, 10013","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"37-66 82nd Street, Queens, 11372","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"380 Amsterdam Avenue, Manhattan, 10024","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"4 Amsterdam Avenue, Manhattan, 10023","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"4 Columbus Circle, Manhattan, 10019","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"4 Park Avenue, Manhattan, 10016","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"4 West 4th Street, Manhattan, 10012","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"40 Wall Street, Manhattan, 10005","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"401 East 86th Street, Manhattan, 10028","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"401 Park Avenue South, Manhattan, 10016","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"425 Main Street, Manhattan, 10044","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"436 86th Street, Brooklyn, 11209","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"459 Broadway, Manhattan, 10013","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"460 8th Avenue, Manhattan, 10001","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"465 2nd Avenue, Manhattan, 10016","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"47-02 5th Street, Queens, 11101","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"5411 Myrtle Avenue, Queens, 11385","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"60 Spring Street, Manhattan, 10012","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"60-02 Roosevelt Avenue, Queens, 11377","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"609 Columbus Avenue, Manhattan, 10024","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"619 9th Avenue, Manhattan, 10036","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"661 8th Avenue, Manhattan, 10036","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"700 Columbus Avenue, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"721 9th Avenue, Manhattan, 10019","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"724 Flatbush Avenue, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"73-01 37th Avenue, Queens, 11372","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"756 Myrtle Avenue, Brooklyn, 11206","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"77 7th Avenue, Manhattan, 10011","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"773 Lexington Avenue, Manhattan, 10065","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"777 Avenue Of The Americas, Manhattan, 10001","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"84-32 Jamaica Avenue, Queens, 11421","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"852 2nd Avenue, Manhattan, 10017","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"900 8th Avenue, Manhattan, 10019","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"931 1st Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"949 3rd Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"95-11 63rd Drive, Queens, 11374","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"101 Clinton Street, Brooklyn, 11201","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"102-30 Atlantic Avenue, Queens, 11416","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1033 St. Nicholas Avenue, Manhattan, 10032","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"109-07 101st Avenue, Queens, 11419","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1091 Ogden Avenue, Bronx, 10452","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"115-10 Merrick Boulevard, Queens, 11434","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"122-02 Liberty Avenue, Queens, 11419","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"144-29 Northern Boulevard, Queens, 11354","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1510 St. Nicholas Avenue, Manhattan, 10033","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1535 2nd Avenue, Manhattan, 10075","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"162-19 Hillside Ave, Queens, 11432","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"165-02 Baisley Boulevard, Queens, 11434","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1679 Bedford Avenue, Brooklyn, 11225","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1791 Utica Avenue, Brooklyn, 11234","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"182 Smith Street, Brooklyn, 11201","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"1849 2nd Avenue, Manhattan, 10128","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"188 9th Avenue, Manhattan, 10011","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"210 Amsterdam Avenue, Manhattan, 10023","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"21-25 Broadway, Queens, 11106","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2158 White Plains Rd, Bronx, 10462","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"2170 Frederick Douglass Boulevard, Manhattan, 10026","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"218-35 Hempstead Avenue, Queens, 11429","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"21b Knolls Crescent, Bronx, 10463","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"222-14 Linden Boulevard, Queens, 11411","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"225 Liberty Street, Manhattan, 10280","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"245-14 Francis Lewis Boulevard, Queens, 11422","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"249 7th Avenue, Brooklyn, 11215","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"26 Grand Central Terminal, Manhattan, 10017","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"2748 East Tremont Avenue, Bronx, 10461","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"2819 Church Avenue, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"282 8th Avenue, Manhattan, 10001","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"3001 Mermaid Avenue, Brooklyn, 11224","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"301 West 50th Street, Manhattan, 10019","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"320 Smith Street, Brooklyn, 11231","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"32-14 31st Street, Queens, 11106","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"33-01 30th Avenue, Queens, 11103","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"3539 Broadway, Manhattan, 10031","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"3700-06 Junction Boulevard, Queens, 11368","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"3823 Nostrand Avenue, Brooklyn, 11235","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"408 Grand Street, Manhattan, 10002","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"4188 Broadway, Manhattan, 10033","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"43-02 Ditmars Boulevard, Queens, 11105","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"43-20 Bell Boulevard, Queens, 11361","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"45-02 43rd Avenue, Queens, 11104","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"46-12 Greenpoint Avenue, Queens, 11104","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"4910 Broadway, Manhattan, 10034","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"501 Avenue Of The Americas, Manhattan, 10011","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"50-15 Roosevelt Avenue, Queens, 11377","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"534 Hudson Street, Manhattan, 10014","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"55-60 Myrtle Avenue, Queens, 11385","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"57 East Burnside Avenue, Bronx, 10453","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"5901 Bay Parkway, Brooklyn, 11204","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"60-26 Woodside Avenue, Queens, 11377","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"63-37 108th Street, Queens, 11375","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"6423 Ft Hamilton Parkway, Brooklyn, 11219","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"650 Castle Hill Avenue, Bronx, 10473","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"69-62 188th Street, Queens, 11365","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"7 Madison Street, Manhattan, 10038","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"71-14 Austin Street, Queens, 11375","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"7118 3rd Avenue, Brooklyn, 11209","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"71-18 Kissena Boulevard, Queens, 11367","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"741 Columbus Avenue, Manhattan, 10025","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"7812 Flatlands Avenue, Brooklyn, 11236","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"783 Manhattan Avenue, Brooklyn, 11222","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"81 1st Avenue, Manhattan, 10003","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"85-10 Northern Boulevard, Queens, 11372","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"892 Flatbush Avenue, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"911 Morris Park Avenue, Bronx, 10462","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"925 Soundview Ave, Bronx, 10473","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"950 Southern Boulevard, Bronx, 10459","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"95-14 63rd Drive, Queens, 11374","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"960 Halsey Street, Brooklyn, 11233","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"96-02 Rockaway Blvd, Queens, 11417","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"9738 Seaview Avenue, Brooklyn, 11236","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1551 Richmond Avenue, Staten Island, 10314","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"946 Kings Highway, Brooklyn, 11223","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"103-14 Roosevelt Avenue, Queens, 11368","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1227 Forest Avenue, Staten Island, 10310","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"14-01 College Point Boulevard, Queens, 11356","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1759 Hylan Boulevard, Staten Island, 10305","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"955 Manor Road, Staten Island, 10314","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"298 1st Avenue, Manhattan, 10009","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"6628 18th Avenue, Brooklyn, 11204","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1820 Williamsbridge Road, Bronx, 10461","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"114 Beverley Road, Brooklyn, 11218","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1281 Fulton Street, Brooklyn, 11216","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2325 Flatbush Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"93-12 Astoria Boulevard, Queens, 11369","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"175-06 Hillside Avenue, Queens, 11432","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3575 Boston Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"5564 Broadway, Bronx, 10463","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"132-50 Metropolitan Avenue, Queens, 11418","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"58-02 Metropolitan Avenue, Queens, 11385","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"33-55 Crescent Street, Queens, 11106","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"104-25 Queens Boulevard, Queens, 11375","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"44-15 Kissena Boulevard, Queens, 11355","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"9408 3rd Avenue, Brooklyn, 11209","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"82-77 Broadway, Queens, 11373","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"755 Broadway, Brooklyn, 11206","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1612 Westchester Avenue, Bronx, 10472","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"109-62 Francis Lewis Boulevard, Queens, 11429","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"713 Brighton Beach Avenue, Brooklyn, 11235","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"406 East Fordham Road, Bronx, 10458","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"379 Myrtle Avenue, Brooklyn, 11205","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3000 Church Avenue, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"73-21 Kissena Boulevard, Queens, 11367","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1366 Broadway, Brooklyn, 11221","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1371 Metropolitan Avenue, Bronx, 10462","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1409 Avenue J, Brooklyn, 11230","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"5716 Avenue U, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"5001 Church Avenue, Brooklyn, 11203","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3082 Avenue U, Brooklyn, 11229","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"84-20 Broadway, Queens, 11373","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"4915 Flatlands Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"210 Union Avenue, Brooklyn, 11211","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2590 Coney Island Avenue, Brooklyn, 11223","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"119-02 Rockaway Boulevard, Queens, 11420","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1847 Rockaway Parkway, Brooklyn, 11236","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"159-34 Jamaica Avenue, Queens, 11432","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1328 2nd Avenue, Manhattan, 10021","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"127-04 Guy R Brewer Boulevard, Queens, 11434","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"149-28 14th Avenue, Queens, 11357","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"758 Arthur Kill Road, Staten Island, 10312","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"219-14 Merrick Boulevard, Queens, 11413","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2270 Clove Road, Staten Island, 10305","vaccines":["Moderna"]},{"name":"J&N Pharmacy","address":"1220 Morris Avenue, Bronx, 10456","vaccines":["Moderna"]},{"name":"St. Jude Pharmacy","address":"121 St. Nicholas Avenue, Brooklyn, 11237","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"255-01 Union Turnpike, Queens, 11004","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2750 Boston Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"47-07 Broadway, Queens, 11103","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3901 White Plains Road, Bronx, 10466","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1559 Flatbush Avenue, Brooklyn, 11210","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"32 East 170th Street, Bronx, 10452","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"4123 Avenue D, Brooklyn, 11203","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"78-14 Linden Boulevard, Queens, 11414","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3012 3rd Avenue, Bronx, 10455","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"583 Grandview Avenue, Queens, 11385","vaccines":["Moderna"]},{"name":"Rite Aid Pharmacy","address":"85 Avenue D, Manhattan, 10009","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"110-88 Queens Boulevard, Queens, 11375","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"75-75 31st Avenue, Queens, 11370","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"91-08 Roosevelt Avenue, Queens, 11372","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"119-10 Liberty Avenue, Queens, 11419","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"39-20 Bell Boulevard, Queens, 11361","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"3480 Jerome Avenue, Bronx, 10467","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"3040 Eastchester Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"541 West 235th Street, Bronx, 10463","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"650 East Tremont Avenue, Bronx, 10457","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"49 West Fordham Road, Bronx, 10468","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3590 East Tremont Avenue, Bronx, 10465","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"4232 Baychester Ave, Bronx, 10466","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"691 Co-Op City Boulevard, Bronx, 10475","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"7009 13th Avenue, Brooklyn, 11228","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1532 86th Street, #34, Brooklyn, 11228","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1040 St. Johns Place, Brooklyn, 11213","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"6101 18th Avenue, Brooklyn, 11204","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"7821 3rd Avenue, Brooklyn, 11209","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"355 Knickerbocker Avenue, Brooklyn, 11237","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2532 86th Street, #54, Brooklyn, 11214","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"120 Court Street, Brooklyn, 11201","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"61-29 Springfield Blvd, Queens, 11364","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"90-01 Sutphin Boulevard, Queens, 11435","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1720 Kings Highway, Brooklyn, 11229","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1111 Pennsylvania Avenue, Brooklyn, 11207","vaccines":["Pfizer"]},{"name":"Mellor's Drug Store","address":"3343 Fulton Ave, Brooklyn, 11208","vaccines":["Moderna"]},{"name":"COSTCO Pharmacy","address":"61-35 Junction Blvd, Queens, 11374","vaccines":["Moderna"]},{"name":"Sure Drugs","address":"312 Ralph Ave, Brooklyn, 11233","vaccines":["Moderna"]},{"name":"Mass Vaccination Site - Citi Field","address":"36-2 126th St, Cars enter through gate 11, Queens, 11368","vaccines":["Pfizer"]},{"name":"Ford Foundation","address":"321 E 42nd Street, Manhattan, 10017","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1419 Newkirk Ave, Brooklyn, 11226","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"160-40 Cross Bay Boulevard, Queens, 11414","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"462 5th Avenue, Brooklyn, 11215","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"304 Park Ave South, Manhattan, 10010","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"315 N End Ave, Manhattan, 10282","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"506-528 Utica Avenue, Brooklyn, 11203","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"526 W 30th Street, Manhattan, 10001","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"8011 Eliot Ave, Queens, 11379","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"153-45 Cross Island Pkwy, Queens, 11357","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"750 Manhattan Avenue, Brooklyn, 11222","vaccines":["Moderna"]},{"name":"Richmond University Medical Center","address":"355 Bard Ave, Staten Island, 10310","vaccines":["Moderna","Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1517 Cortelyou Road, Brooklyn, 11226","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"568 West 125th Street, Manhattan, 10027","vaccines":["Pfizer"]},{"name":"Teachers Preparatory High School","address":"226 Bristol Street, Brooklyn, 11212","vaccines":["Pfizer"]},{"name":"Mass Vaccination Site - Empire Outlets","address":"55 Richmond Terrace, Staten Island, 10301","vaccines":["Pfizer"]},{"name":"NYS-FEMA York College","address":"160-02 Liberty Ave, Queens, 11433","vaccines":["Pfizer"]},{"name":"NYS-FEMA Medgar Evers College","address":"231 Crown Street, Brooklyn, 11225","vaccines":["Pfizer"]},{"name":"Medicine Center Rx LLC","address":"92 East 167th Street, Bronx, 10452","vaccines":["Moderna"]},{"name":"New Amsterdam Drug Mart Inc.","address":"698 Amsterdam Avenue, Manhattan, 10025","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - City College of New York - North Academic Center","address":"1549 Amsterdam Ave, Manhattan, 10031","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - City Point","address":"445 Albee Square West, Brooklyn, 11201","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Bronx High School of Science","address":"75 West 205th Street, Bronx, 10468","vaccines":["Moderna"]},{"name":"NYC Vaccine Hub - Essex Crossing","address":"244B Broome Street, Manhattan, 10002","vaccines":["Moderna"]},{"name":"HSS - Martin Van Buren HS","address":"230-17 Hillside Avenue, Queens, 11427","vaccines":["Pfizer"]},{"name":"Rossi Pharmacy","address":"1891 Eastern Parkway, Brooklyn, 11233","vaccines":["Moderna"]},{"name":"Centers Urgent Care - Coney Island","address":"626 Sheepsheadbay Road, Brooklyn, 11224","vaccines":["Moderna"]},{"name":"Centers Urgent Care - Middle Village","address":"61-22 Fresh Pond Road, Queens, 11379","vaccines":["Moderna"]},{"name":"Centers Urgent Care - Flatbush","address":"1811 Avenue J, Brooklyn, 11230","vaccines":["Moderna"]},{"name":"Centers Urgent Care - Gateway Mall","address":"1203 Elton Street, Brooklyn, 11239","vaccines":["Moderna"]},{"name":"Centers Urgent Care - Avenue U","address":"2370 Coney Island Avenue, Brooklyn, 11223","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1 Union Square South, Manhattan, 10003","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"4714 16th Avenue, Brooklyn, 11204","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"530 5th Avenue, Manhattan, 10036","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"711 3rd Avenue, Manhattan, 10017","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"655 Rossville Avenue, Staten Island, 10309","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1 Whitehall Street, Manhattan, 10004","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1251 Avenue Of The Americas, Manhattan, 10020","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"125 3rd Avenue, Manhattan, 10003","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"16 Court Street, Brooklyn, 11241","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"305 Broadway, Manhattan, 10007","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"3155 Amboy Road, Staten Island, 10306","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"333 7th Avenue, Manhattan, 10001","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"37 Broadway, Manhattan, 10006","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"386 Fulton Street, Brooklyn, 11201","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"41 East 58th Street, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"485 Lexington Avenue, Manhattan, 10017","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"49 East 52nd Street, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"51 West 51st Street, Manhattan, 10019","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"559 Fulton Street, Brooklyn, 11201","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"58 East Fordham Road, Bronx, 10468","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"625 8th Avenue, Manhattan, 10018","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"67 Broad Street, Manhattan, 10004","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"95 Wall Street, Manhattan, 10005","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"186-16 Union Turnpike, Queens, 11366","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"145 4th Avenue, Manhattan, 10003","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"350 5th Avenue, Manhattan, 10118","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"2504 Eastchester Road, Bronx, 10469","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"3085 East Tremont Avenue, Bronx, 10461","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"55 Westchester Square, Bronx, 10461","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"19-23 Utopia Parkway, Queens, 11357","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1627 Broadway, Manhattan, 10019","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"1430 Broadway, Manhattan, 10018","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"866 3rd Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"5008 5th Avenue, Brooklyn, 11220","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"17 John Street, Manhattan, 10038","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"455 West 37th Street, Manhattan, 10018","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"575 Lexington Avenue, Manhattan, 10022","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"100 Broadway, Manhattan, 10005","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"589 Prospect Avenue, Brooklyn, 11215","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"193-01 Northern Boulevard, Queens, 11358","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"58-01 Queens Boulevard, Queens, 11377","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"106-40 Rockaway Beach Boulevard, Queens, 11694","vaccines":["Pfizer"]},{"name":"Walgreens/Duane Reade","address":"2431 Boston Road, Bronx, 10467","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1350 Broadway, Manhattan, 10018","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"1710 Crosby Avenue, Bronx, 10461","vaccines":["Moderna"]},{"name":"Walgreens/Duane Reade","address":"5822 99th St, Queens, 11368","vaccines":["Pfizer"]},{"name":"NYC Vaccine Hub - West Bronx Gymnasium","address":"1527 Jesup Avenue, Bronx, 10452","vaccines":["Moderna"]},{"name":"Hopkins Drugs & Compounding","address":"63-19 Roosevelt Avenue, Queens, 11377","vaccines":["Moderna"]},{"name":"Myrtle Drugs","address":"1454 Myrtle Avenue, Brooklyn, 11237","vaccines":["Moderna"]},{"name":"Top Value Pharmacy & Compounding","address":"3811 Dyre Avenue, Bronx, 10466","vaccines":["Moderna"]},{"name":"Stop & Shop #505","address":"1710 Avenue Y, Brooklyn, 11235","vaccines":["Moderna"]},{"name":"Apthorp Pharmacy","address":"2191 Broadway, Manhattan, 10024","vaccines":["Moderna"]},{"name":"Bronx Co-Op City Dreiser Community Center","address":"177 Dreiser Loop, Bronx, 10475","vaccines":["Johnson & Johnson"]},{"name":"Brightpoint Church Avenue Health Center","address":"2412 Church Avenue, Brooklyn, 11226","vaccines":["Moderna","Pfizer"]},{"name":"Mass Vaccination Site - Yankee Stadium","address":"1 E 161st Street, Bronx, 10451","vaccines":["Pfizer","Johnson & Johnson"]},{"name":"NorthPoint Medical Associates","address":"1301 Southern Boulevard, 2nd Fl, Bronx, 10459","vaccines":["Moderna"]},{"name":"Remedies Pharmacy","address":"711 Bedford Avenue, Brooklyn, 11206","vaccines":["Moderna"]},{"name":"Ocean Park Drugs","address":"17-27 Seagirt Boulevard, Queens, 11691","vaccines":["Moderna"]},{"name":"Franhill Pharmacy","address":"204-19 Hillside Avenue, Queens, 11423","vaccines":["Moderna"]},{"name":"Bedford-Stuyvesant Restoration Corporation","address":"1368 Fulton Street, Community Room, Brooklyn, 11216","vaccines":["Moderna"]},{"name":"Wellness Pharmacy","address":"144 West 72nd Street, Manhattan, 10023","vaccines":["Moderna"]},{"name":"NYPD Community Center","address":"127 Pennsylvania Avenue, Brooklyn, 11027","vaccines":["Johnson & Johnson"]},{"name":"Rite Aid Pharmacy","address":"2064 Mill Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"344 Avenue X, Brooklyn, 11223","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"1346 Pennsylvania Avenue, Brooklyn, 11239","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"1402 Sheepshead Bay Road, Brooklyn, 11235","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"224 East 161st Street, Bronx, 10451","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"50 East 167th Street, Bronx, 10452","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"532 Neptune Avenue, Brooklyn, 11224","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"178-02 Hillside Avenue, Queens, 11432","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"1-50 50th Ave, Queens, 11101","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"1179 East 233rd Street, Bronx, 10466","vaccines":["Pfizer"]},{"name":"Rite Aid Pharmacy","address":"5825-35 Broadway, Bronx, 10463","vaccines":["Pfizer"]},{"name":"Medrite Urgent Care","address":"504 Myrtle Ave, Brooklyn, 11215","vaccines":["Moderna"]},{"name":"NYS - Bay Eden Senior Center","address":"1220 East 229th Street, Bronx, 10466","vaccines":["Pfizer"]},{"name":"86 BoBo Pharmacy Inc.","address":"2170 86th Street, Brooklyn, 11214","vaccines":["Moderna"]},{"name":"New York-Presbyterian Hospital - The Armory","address":"651 W 168th Street, Manhattan, 10032","vaccines":["Pfizer"]},{"name":"Lenox Health Greenwich Village","address":"200 W 13th Street, Manhattan, 10011","vaccines":["Pfizer"]},{"name":"Spring Creek Towers - Cityblock Health","address":"1310 Pennsylvania Avenue, Brooklyn, 11239","vaccines":["Pfizer"]},{"name":"Interfaith Medical Center","address":"1545 Atlantic Avenue, Brooklyn, 11213","vaccines":["Pfizer","Johnson & Johnson"]},{"name":"Sorin Medical PC","address":"1110 Pennsylvania Avenue, Brooklyn, 11207","vaccines":["Moderna"]},{"name":"CVS Pharmacy","address":"130 Dyckman Street, Manhattan, 10040","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"130 Lenox Avenue, Manhattan, 10026","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"1571 Forest Avenue, Staten Island, 10302","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"206-09 Linden Boulevard, Queens, 11411","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"282 East 149th Street, Bronx, 10451","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"35-26 Francis Lewis Boulevard, Queens, 11358","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"88-07 Rockaway Beach Boulevard, Queens, 11693","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"1440 Broadway, Manhattan, 10018","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"2833 Broadway, Manhattan, 10025","vaccines":["Pfizer"]},{"name":"Flatbush YMCA","address":"1401 Flatbush Avenue, Brooklyn, 11210","vaccines":["Pfizer"]},{"name":"Korean Community Services","address":"203-05 32nd Avenue, Queens, 11361","vaccines":["Pfizer"]},{"name":"Endocrine Associate of West Village, PC","address":"36-36 33rd Street, Suite 311, Queens, 11106","vaccines":["Pfizer"]},{"name":"Bakers Drugs","address":"205-43 Linden Boulevard, Queens, 11412","vaccines":["Moderna"]},{"name":"NYC Health + Hospitals, Queens","address":"82-68 164th Street, Queens, 11432","vaccines":["Pfizer"]},{"name":"Super Health Pharmacy","address":"6400 Amboy Road, Staten Island, 10309","vaccines":["Moderna"]},{"name":"Abyssinian Baptist Church","address":"132 West 138th Street, Manhattan, 10030","vaccines":["Pfizer"]},{"name":"BMS Family Health Center at St. Paul Community Baptist Church","address":"859 Hendrix Street, Brooklyn, 11207","vaccines":["Pfizer"]},{"name":"NuCare Pharmacy","address":"1789 1st Avenue, Manhattan, 10128","vaccines":["Johnson & Johnson"]},{"name":"Union Community Health Center - 188th Street","address":"260 East 188th Street, Bronx, 10458","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"288 St Nicholas Avenue, Manhattan, 10027","vaccines":["Johnson & Johnson"]},{"name":"CVS Pharmacy","address":"3536 Broadway, Manhattan, 10031","vaccines":["Johnson & Johnson"]},{"name":"CVS Pharmacy","address":"10204 Flatlands Avenue, Brooklyn, 11236","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"115 W. 125th Street, Manhattan, 10027","vaccines":["Johnson & Johnson"]},{"name":"CVS Pharmacy","address":"1172 3rd Avenue, Manhattan, 10065","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"1361 Hylan Boulevard, Staten Island, 10305","vaccines":["Johnson & Johnson"]},{"name":"CVS Pharmacy","address":"1933 Victory Boulevard, Staten Island, 10314","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"20 University Place, Manhattan, 10003","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"20-21 Francis Lewis Boulevard, Queens, 11357","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"2045 Forest Avenue, Staten Island, 10303","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"215 Park Avenue South, Manhattan, 10003","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"215-08 73rd Avenue, Windsor Park S/C, Queens, 11364","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"219-39 89th Avenue, Queens, 11427","vaccines":["Johnson & Johnson"]},{"name":"CVS Pharmacy","address":"2320 Ralph Avenue, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"2465 Richmond Avenue, Staten Island, 10314","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"250 Page Avenue, Staten Island, 10307","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"2690 Hylan Boulevard, Staten Island, 10306","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"31-01 Ditmars Boulevard, Queens, 11105","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"3125 Bainbridge Avenue, Bronx, 10467","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"3681 Bruckner Boulevard, Bronx, 10461","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"3775 East Tremont Avenue, Bronx, 10465","vaccines":["Johnson & Johnson"]},{"name":"CVS Pharmacy","address":"4065 Amboy Road, Staten Island, 10308","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"4901 Kings Highway, Brooklyn, 11234","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"500 West 23rd Street, Manhattan, 10011","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"640 Arthur Kill Road, Staten Island, 10308","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"6831 Bay Parkway, Brooklyn, 11204","vaccines":["Johnson & Johnson"]},{"name":"CVS Pharmacy","address":"72-09 Northern Boulevard, Queens, 11372","vaccines":["Johnson & Johnson"]},{"name":"CVS Pharmacy","address":"7960 Metropolitan Avenue, Queens, 11379","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"305 East 86th Street, Manhattan, 10028","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"251-21 Jamaica Ave, Queens, 11426","vaccines":["Pfizer"]},{"name":"CVS Pharmacy","address":"161 Avenue Of The Americas, Manhattan, 10013","vaccines":["Pfizer"]}]`);


  // shorthand`
  selector = tpl.selector;

  tpl.initialize();

  window.butler = tpl;


})();
