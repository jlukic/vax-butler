## RELEASE NOTES

### Version 1.0.0 - April 4, 2021
- Initial release

### Version 1.0.1 - April 5, 2021 6PM
- Adds new UI for search overlay with more information


### Version 1.0.2 - April 5, 2021 7PM
- Add date to completion modal
- Add error modal if triggering on different domain
- Updated scraped vaccine data json

### Version 1.0.3 - April 9, 2021 7PM

NYC's vaccination website has added pretty aggressive rate limiting meaning which means even doing actions without Vaccine Butler seems to be blocked if they occur too frequently.

We've added settings so users can modify the frequency of checks to avert the rate limiter, and set a much higher default.

#### Features
- Added settings for search interval and delay to check page
- Adjusted default search interval to handle rate limiting
- Updated overlay to show search interval
