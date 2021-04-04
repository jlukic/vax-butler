// run in headless chrome or manually @ <https://vaccinefinder.nyc.gov/locations>
// this collects minimal data to reduce filesize
// match is expected on location name
let venues = [];
$('.cWGcdI').each(function() {
  let vaccines = [];

  $(this).find('.fIddar li').each(function() {
    let vaccineName = $(this).text();
    vaccines.push(vaccineName);
  });
  venues.push({
    name: $(this).find('h2').text(),
    vaccines: vaccines
  });
});
