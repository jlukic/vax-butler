// run in headless chrome or manually @ <https://vaccinefinder.nyc.gov/locations>
// this collects minimal data to reduce filesize
// match is expected on location name


var jq = document.createElement('script');
jq.src = "https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js";
document.getElementsByTagName('head')[0].appendChild(jq);

let locations = [];
$('.cWGcdI').each(function() {
  let vaccines = [];
  $(this).find('.fIddar li').each(function() {
    let vaccineName = $(this).text().trim();
    vaccines.push(vaccineName);
  });
  locations.push({
    name: $(this).find('h2').text().trim(),
    address: $(this).find('p').first().text().trim(),
    vaccines: vaccines
  });
});

locationJSON = JSON.stringify(locations);

