# Vaccine Butler
Self-use Automated Appointment NYC Vaccination Booker

[vaccinebutler.com](https://www.vaccinebutler.com)

> Note: There may be multiple rapid updates to this tool in the next few days. Be sure to update your bookmarklet regularly to have the latest up to date code.

# Vaccine Butler

Key Features
* Search by desired vaccine
* Choose location by borough, max travel distance
* Select times based off min/max hour of day
* Tool-assist booking, no remote server involved, book your own appointment directly from Chrome.

Vaccine butler is a script designed to run ontop of NYC's Vaccine Finder website to automate appointment booking. It is intended to be used by non-technical users, and help anyone who is frustrated with being unable to find any open appointments. 

## How To Use

1) Follow setup guide [https://www.vaccinebutler.com](https://www.vaccinebutler.com/setup) to add bookmarklet
2) Run bookmarklet from NYC Vaccine Registration page *after completing vaccine registration* on screen with available appointments.

## User Support
We will be adding chat support shortly to help provide help using the tool.

## Demo
![Screen](https://vaccinebutler.com/images/demo.gif)

## Developing Notes / Build Instructions

The whole bookmarklet can be found in [vaccine_butler.js](https://github.com/jlukic/vax-butler/blob/main/src/vaccine_butler.js). This also includes some templates and css that are (for now) manually copy and pasted in from the designs [found here](https://github.com/jlukic/vax-butler/tree/main/src/designs)

Vaccine info is created by generating a JSON file using the script [scrape_locations.js](https://github.com/jlukic/vax-butler/blob/main/src/scrape_locations.js) on the URL https://vaccinefinder.nyc.gov/locations. You can do this directly from the chrome console and then paste into https://github.com/jlukic/vax-butler/blob/main/src/vaccine_butler.js

The bookmarklet code is generated manually using [UglifyJS](https://github.com/mishoo/UglifyJS) (Minification) + [Bookmarkleter](https://chriszarate.github.io/bookmarkleter/) (Escaping).

To test modifications locally, I've found the best way is to use the Chrome DevTools [Snippets Panel](https://developer.chrome.com/docs/devtools/javascript/snippets/)on the live site.

Site code is generated using a static site generator and found in `/site` folder. You can run locally using `npm install` then `docpad run`

## How It Works

This script is relatively simple and has two main loops. The search loop searches the page every (X) seconds by entering information into the zipcode and date field. The check loop, checks the DOM resulting from the search to extract information about each appointment and then check that appointment list against the user's set of constraints. 

The original code used mutationobservers to avoid having to "guess" how long loading would take, but we ended up running into issues with the observers not reporting correctly. Perhaps related to [Salesforce Lockerservice](https://developer.salesforce.com/blogs/developer-relations/2016/04/introducing-lockerservice-lightning-components.html) 'security'.  The adapted [`$`](https://github.com/jlukic/vax-butler/blob/main/src/vaccine_butler.js#L38) function is meant to fix 'security' that prevented `document.querySelectorAll` from properly reporting matches. 

