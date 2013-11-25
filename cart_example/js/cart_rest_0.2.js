// requires jQuery 1.7.2+
// requires JSON (json2.js is a nice one...)

// This file is listed at v0.1 because it contains only a few of the cart rest calls.
// It will be gradually expanded as needed.  Feel free to contribute if you need something.


// create the ultracart namespace if needed
if (typeof ultracart == 'undefined') {
  ultracart = {};
}

ultracart.Cart = function (merchantId, restUrl, receiptHostName) {
  this.merchantId = merchantId;
  this.restUrl = restUrl; // this may or may not contain a proxy


  // can be null.  defaults to secure.ultracart.com if null.  could also be www.mystore.com if that was your url.
  // the receiptHostName is where the checkout finishes (receipt).  many merchants have dozens of sites.
  // So, if this isn't secure.ultracart.com and you have more than one site, you must specify it.
  this.receiptHostName = receiptHostName || null;


  /**
   * registers a customer into the system using the password and email properties of the cart.
   * If successful, returns an updated cart object.
   * If unsuccessful, you may OR may not receive back a cart.  It all depends on the error
   * and whether the server can construct a return cart.  Check the cart.errors property for errors.  If the call
   * fails outright, the request headers will contain a header 'UC-REST-ERROR' that should
   * be consulted (or displayed).
   * If the email and password match an existing customer, the customer is logged in.  If the password does not match,
   * the customer will receive a "profile already exists" error.
   * @param cart the current shopping cart
   * @param [options] success and failure callbacks
   * @return if no callbacks specified, this returns back a cart object (check cart.errors for any issues!), else null
   */
  this.register = function (cart, options) {

    options = options || {};

    var updatedCart = null;

    jQuery.ajax({
      url: this.restUrl + '/cart/register',
      data: JSON.stringify(cart),
      type: 'post',
      async: (options.success || options.failure) ? true : false,
      headers: { "cache-control": "no-cache" },
      contentType: 'application/json; charset=UTF-8',
      cache: false,
      dataType: 'json'
    }).done(function (result) {
              updatedCart = result;
              if (options.success) {
                options.success(updatedCart);
              }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
              if (options.failure) {
                options.failure(jqXHR, textStatus, errorThrown);
              }
            });

    return updatedCart;
  };


  /**
   * logs a customer into the system using the password and email properties of the cart.  If successful, returns
   * an updated cart object.  If unsuccessful, you may OR may not receive back a cart.  It all depends on the error
   * and whether the server can construct a return cart.  Check the cart.errors property for errors.  If the call
   * fails outright, the request headers will contain a header 'UC-REST-ERROR' that should
   * be consulted (or displayed).
   * @param cart the current shopping cart
   * @param [options] success and failure callbacks
   * @return if no callbacks specified, this returns back a cart object (check cart.errors for any issues!), else null
   */
  this.login = function (cart, options) {

    options = options || {};

    var updatedCart = null;

    jQuery.ajax({
      url: this.restUrl + '/cart/login',
      data: JSON.stringify(cart),
      type: 'post',
      async: (options.success || options.failure) ? true : false,
      headers: { "cache-control": "no-cache" },
      contentType: 'application/json; charset=UTF-8',
      cache: false,
      dataType: 'json'
    }).done(function (result) {
              updatedCart = result;
              if (options.success) {
                options.success(updatedCart);
              }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
              if (options.failure) {
                options.failure(jqXHR, textStatus, errorThrown);
              }
            });

    return updatedCart;
  };


  /**
   * logs a customer OUT of the system.  If successful, returns
   * an updated cart object.  If unsuccessful, the request headers will contain a header 'UC-REST-ERROR' that should
   * be consulted (or displayed).
   * @param cart the current shopping cart
   * @param [options] success and failure callbacks
   * @return if no callbacks specified, this returns back a cart object, else null
   */
  this.logout = function (cart, options) {

    options = options || {};

    var updatedCart = null;

    jQuery.ajax({
      url: this.restUrl + '/cart/logout',
      data: JSON.stringify(cart),
      type: 'post',
      async: (options.success || options.failure) ? true : false,
      headers: { "cache-control": "no-cache" },
      contentType: 'application/json; charset=UTF-8',
      cache: false,
      dataType: 'json'
    }).done(function (result) {
              updatedCart = result;
              if (options.success) {
                options.success(updatedCart);
              }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
              if (options.failure) {
                options.failure(jqXHR, textStatus, errorThrown);
              }
            });

    return updatedCart;
  };


  /**
   * requests the shipping methods and returns them.  if called async, the methods are passed to the success methods
   * @param cart
   * @param options
   */
  this.estimateShipping = function (cart, options) {
    options = options || {};
    var result = null;

    jQuery.ajax({
      url: this.restUrl + '/cart/estimateShipping',
      type: 'POST',
      headers: { "cache-control": "no-cache" },
      contentType: 'application/json; charset=UTF-8',
      data: JSON.stringify(cart),
      dataType: 'json'
    }).done(function (availableShippingMethods) {

              result = availableShippingMethods;
              if (options.success) {
                options.success(availableShippingMethods);
              }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
              // check jqXHR.getHeader('UC-REST-ERROR')
              if (options.failure) {
                options.failure(jqXHR, textStatus, errorThrown);
              }

            });

    return result;

  };


  this.getCart = function (cartId, options) {

    options = options || {};
    var result = null;

    jQuery.ajax({
      url: this.restUrl + "/cart" + (cartId ? ("/" + cartId) : ""),
      headers: {'X-UC-Merchant-Id': this.merchantId,
        "cache-control": "no-cache"},
      dataType: 'json'
    }).done(function (cart) {
              result = cart;
              if (options.success) {
                options.success(result);
              }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
              // check jqXHR.getHeader('UC-REST-ERROR')
              if (options.failure) {
                options.failure(jqXHR, textStatus, errorThrown);
              }
            });

    return result;
  };


  this.updateCart = function (cart, options) {

    options = options || {};
    var result = null;

    jQuery.ajax({
      url: this.restUrl + "/cart",
      type: 'POST',
      headers: { "cache-control": "no-cache" },
      contentType: 'application/json; charset=UTF-8',
      data: JSON.stringify(cart),
      dataType: 'json'
    }).done(function (updatedCart) {
              result = updatedCart;
              if (options.success) {
                options.success(result);
              }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
              // check jqXHR.getHeader('UC-REST-ERROR')
              if (options.failure) {
                options.failure(jqXHR, textStatus, errorThrown);
              }
            });

    return result;
  };


  this.checkout = function (cart, options) {

    options = options || {};
    var result = null;

    // Notice: The checkout call does not take a cart.  It takes a CheckoutRequest which contains a cart.
    // Since the checkout process hands off to UltraCart to handle upsells, etc., we must also provide the return point.
    var checkoutRequest = {
      'cart': cart,
      errorParameterName: 'error', // if there are errors after the handoff, the redirect page will receive those errors using this http parameter
      errorReturnUrl: document.URL, // this same page.
      secureHostName: this.receiptHostName
    };

    jQuery.ajax({
      url: this.restUrl + '/cart/checkout',
      type: 'POST', // Notice
      headers: { "cache-control": "no-cache" },
      contentType: 'application/json; charset=UTF-8',
      data: JSON.stringify(checkoutRequest),
      dataType: 'json'
    }).done(function (checkoutResult) {
              result = checkoutResult;
              if (options.success) {
                options.success(checkoutResult);
              }
            })
            .fail(function (jqXHR, textStatus, errorThrown) {
              // check jqXHR.getHeader('UC-REST-ERROR')
              if (options.failure) {
                options.failure(jqXHR, textStatus, errorThrown);
              }
            });

    return result;
  };


};
