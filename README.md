# uber-cities

Visualizing US cities using data scraped from uber.com/us/en/price-estimate.

The data used in order to create this visualization was scraped from Uber's online
price estimation tool using Puppeteer. Rather than use Uber's API (which is not
open to the public), we make a headless request to [Uber's price estimation tool](https://www.uber.com/us/en/price-estimate) and intercept their internal API's HTTP responses.

## Examples

![Los Angeles](https://raw.githubusercontent.com/bravehager/uber-cities/master/img/la.png)

![Washington D.C.](https://raw.githubusercontent.com/bravehager/uber-cities/master/img/dc.png)
