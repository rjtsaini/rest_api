#### UltraCart REST API
Test harness for UltraCart REST API

Please see docs.ultracart.com for the REST objects and calls.
http://docs.ultracart.com/display/ucdoc/UltraCart+REST+Checkout+API

The [call_examples](call_examples) folder contains examples of individual calls.

The [cart_examples](cart_examples) folder contains a working example of a basic cart.

See the UltraCart project "responsive_checkout" for a mobile friendly, advanced cart.


#### Version 1.1
* PCI 3.0 Compliant.  Added support for UltraCart Hosted Fields in the cart_example. See: http://docs.ultracart.com/display/ucdoc/UltraCart+Hosted+Credit+Card+Fields
* Added localization.  Removed hard coded dollar signs.  Checkout is now easy to use with other currencies
* Updated jQuery and JSON to latest versions to support PCI changes.
* Disabled two demo examples in the call_examples tree.  These are the checkout and finalizeOrder examples.  Although
implementing Hosted Fields is easy to do to a full checkout, it's impossible to show a small snippet of the Hosted Fields
in action because iframes are involved.


#### Version 1.0
Of this release, the changes in the rest_proxy.php script are most important.
Please upgrade your rest_proxy.php scripts as soon as possible.  Doing so will prevent issues with your site.  Additionally,
we've added a proxy version header that will allow us to track which merchants might have out of date proxy scripts in the
future.  This could prove vital to rapidly addressing any compatibility issues that might arise from future server updates.

rest_proxy.php changes:
* Fixes for content-length being sent down when original response was gziped.  Would cause the client problem if the server running the proxy wasn't gziping it as well
* We have disabled gzip upstream until 4/15/2015 at which point everyone should have their proxy scripts upgraded.
* Added a flag that can be set to enable debugging to the error_log instead of having to uncomment all the statements.
* Change SSL certificate verify flag.
* Set an empty Expect header in the request to prevent curl from sending the Expect: 100-Continue header.
* Simplify the HTTP 100 Continue header trimming and allow for multiple of them
* Close out the curl handle sooner.
* Add a proxy version number to the header so we can tell from the server side if people are running out of date proxy



