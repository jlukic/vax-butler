
function selectAppointment({ borough='any', maxMiles=999, minHour=0, maxHour=24} = {}) {

  // attach to mutation observer on .appointment-section

  // each loop on blocks
  let appointments = document.querySelectorAll('.appointment_card');
  for (let appointment of appointments) {
    console.log(appointment);
    let
      isMatch     = true,
      milesEl     = appointment.querySelectorAll('.slds-m-bottom_none')[0],
      addressEl   = milesEl.parentNode,
      address     = addressEl.innerText.split('|')[0].trim(),
      milesString = milesEl.innerHTML.replace(/(\||[a-z]|\s)+/mg,''),
      miles       = parseFloat(milesString, 10),
      borough
    ;
  }

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

  // detect page change

  // show confetti overlay with the time and place
}

function loop() {

}

function refreshResults() {

}


// function refreshAppointments


// function doLoop

