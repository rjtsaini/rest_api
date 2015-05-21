// Things you need to set
var merchantId = 'DEMO';
var usingProxy = true;
var proxyPath = './rest_proxy.php';
var restUrl = usingProxy ? (proxyPath + "?_url=/rest") : "/rest";
var continueShoppingUrl = "/index.html";

// Amazon things you might need to set.
// Note: the cart object will contain this value, but since the html page has it hardcoded, might as well hard code it here too.
var amazonMerchantId = 'SELLERID';

var restWrapper = new ultracart.Cart(merchantId, restUrl);
var cart = null; // http://docs.ultracart.com/display/ucdoc/UltraCart+REST+Checkout+API#UltraCartRESTCheckoutAPI-Cart
var shippingEstimates = null; // http://docs.ultracart.com/display/ucdoc/UltraCart+REST+Checkout+API#UltraCartRESTCheckoutAPI-ShippingEstimate

var amazonIsReady = false; // set when the amazon widgets have loaded (if they're enabled).
var loggedIntoAmazon = false; // the amazon checkout is "in page" vs. checkouts like PayPal which do redirects, so we
// must keep track of whether we're doing an amazon checkout since the entire page changes.

var templates = {};
templates.cartItems = null;
templates.coupons = null;
templates.shippingMethods = null;


// Demo Instructions
// Items to Add: BONE, TSHIRT, PDF, item, P0975
// Invalid Items (try): INVALIDITEM
// Coupons to Add: AFA, 5OFF
// Invalid Coupons (try): INVALIDCOUPON
// Test Credit Card: Visa, 4444333322221111 (Any future exp date, CVV 123)

var finalizing = false; // state variable to prevent double submissions

jQuery(document).ready(function () {

  var cartId = readCookie('UltraCartShoppingCartID');

  // load up all the templates that are needed for the page
  templates.cartItems = Handlebars.compile(jQuery('#cart_items_template').html());
  templates.coupons = Handlebars.compile(jQuery('#coupons_template').html());
  templates.shippingMethods = Handlebars.compile(jQuery('#shipping_methods_template').html());

  jQuery(document).ajaxStart(
          function () {
            jQuery('.ajaxLoad').show();
          }).ajaxStop(function () {
            jQuery('.ajaxLoad').hide();
          });

  jQuery('#finalizeLink').click(function () {
    finalizeOrder();
  });

  jQuery('.ucFormField').unbind('change').bind('change', copyElementValueToCart);

  handleCheckoutErrors(); // if there were any returned from the server, such as CC declined, they'll be in the query parameters

  // load the cart.
  //noinspection JSUnusedLocalSymbols
  restWrapper.getCart(cartId, {
    success: function (result) {
      window.cart = result;
      refreshCart();
      estimateShipping(); // this will call refreshShipping
      createCookie('UltraCartShoppingCartID', cart.cartId, 14);

      if (app.commonFunctions.pretendToBeUCEditor(cart)) {
        updateCart(false);
      }

    },
    failure: function (jqXHR, textStatus, errorThrown) {
      var errorMsg = jqXHR.getResponseHeader('UC-REST-ERROR');
      if (errorMsg) {
        renderErrors([errorMsg]);
      }
    }
  });


});


// this is called by the amazon widget script when it's finished.  we'll track this to know we can show the buttons without issue
function onAmazonLoginReady() {
  amazonIsReady = true;
}


function updateCart(collectFieldsFirst) {

  if (collectFieldsFirst) {
    copyAllElementValuesToCart();
  }

  //noinspection JSUnusedLocalSymbols
  restWrapper.updateCart(cart, {
    success: function (updatedCart) {
      cart = updatedCart;
      refreshCart();
      estimateShipping();
    },
    failure: function (jqXHR, textStatus, errorThrown) {
      var errorMsg = jqXHR.getResponseHeader('UC-REST-ERROR');
      if (errorMsg) {
        renderErrors([errorMsg]);
      }
    }
  });
}


function refreshCart() {

  // Destroy any hosted fields (will re-enable at the end)
  if(window.teardownSecureCreditCardFields){
    window.teardownSecureCreditCardFields();
  }

  // ------------------------------------------------------------
  // Overall Cart Visibility

  if (cart != null && cart.items && cart.items.length > 0) {
    jQuery('#emptyCart').hide();
    jQuery('#shoppingCart').show();
    jQuery('#ucUltraCartCheckoutSection').show();
  } else {
    renderEmptyCart();
    jQuery('#emptyCart').show(); // should already be visible
    jQuery('#shoppingCart').hide(); // should already be hidden
  }

  // ------------------------------------------------------------
  // Server Errors
  if (cart && cart.errors && cart.errors.length) {
    renderErrors(cart.errors);
  }


  // ------------------------------------------------------------
  // Billing/Shipping Same Checkbox

  // decide whether to show billing information.  first, toggle based on the checkbox,
  // then look at the billing fields.  If any are populated, show them.
  showHide(document.getElementById('billingDifferent'), 'billToTable');
  if (cart.billToAddress1 || cart.billToAddress2 || cart.billToCity || cart.billToLastName || cart.billToFirstName || cart.billToState || cart.billToCountry || cart.billToCompany || cart.billToDayPhone) {
    if ((cart.billToAddress1 != cart.shipToAddress1)
            || (cart.billToAddress2 != cart.shipToAddress2)
            || (cart.billToCity != cart.shipToCity)
            || (cart.billToLastName != cart.shipToLastName)
            || (cart.billToFirstName != cart.shipToFirstName)
            || (cart.billToState != cart.shipToState)
            || (cart.billToCountry != cart.shipToCountry)
            || (cart.billToCompany != cart.shipToCompany)
            || (cart.billToDayPhone != cart.shipToPhone)) {

      jQuery('#billingDifferent').attr('checked', true);
      jQuery('#billToTable').show();
    }
  }


  // ------------------------------------------------------------
  // Cart Fields
  jQuery('.ucFormField').each(function (idx, el) {
    jQuery(el).val(cart[el.id]);
  });


  // ------------------------------------------------------------
  // Cart Items

  if (cart != null) {
    var cartItems = cart.items;
    var cartItemsBody = jQuery('#cartItemsBody').html(''); //clear out cart and keep reference for later

    // create the objects for the template
    var items = [];
    for (var i = 0; i < cartItems.length; i++) {
      var item = {};
      item.amount = cartItems[i].totalCostWithDiscountLocalizedFormatted;
      item.image = getCartItemImg(cartItems[i]);
      item.itemId = cartItems[i].itemId;
      item.quantity = cartItems[i].quantity;
      item.description = cartItems[i].description;
      item.position = i;
      items.push(item);
    }

    var itemsContext = {items: items};
    var itemsHtml = templates.cartItems(itemsContext);
    cartItemsBody.html(itemsHtml);

  }


  // ------------------------------------------------------------
  // Coupons

  var couponHtml = '';
  if (cart != null && cart.coupons && cart.coupons.length) {
    var coupons = [];
    for (var j = 0; j < cart.coupons.length; j++) {
      // we just need the code.
      coupons.push(cart.coupons[j].couponCode);
    }

    var couponsContext = {coupons: coupons};
    couponHtml = templates.coupons(couponsContext);
  }
  jQuery('#couponsApplied').html(couponHtml);
  jQuery('#couponContainer').show();


  // ------------------------------------------------------------
  // Summary
  refreshSummary();


  // ------------------------------------------------------------
  // Subtotal
  if (cart != null) {
    if (cart.subtotalDiscount == 0) {
      jQuery('#subtotal1').hide();
      jQuery('#subtotal_label1').hide();
      jQuery('#discount1').hide();
      jQuery('#discount_label1').hide();
    } else {
      jQuery('#subtotal1').show().html(cart.subtotalLocalizedFormatted);
      jQuery('#subtotal_label1').show();
      jQuery('#discount1').show().html(cart.subtotalDiscountLocalizedFormatted);
      jQuery('#discount_label1').show();
    }
    jQuery('#subtotal2').html(cart.subtotalWithDiscountLocalizedFormatted);
  }


  var showConjunction = false; // if we have an alternate payment, we want to show the conjunction phrase "or use the secure order form below"

  // ------------------------------------------------------------
  // PayPal

  // unbind here and rebind to avoid stacking event handlers
  var payPalLink = jQuery('.paypal_link');
  payPalLink.unbind('.ultraCart').removeClass('fake_hyper');

  // if we're using amazon, don't show PayPal.
  if (cart != null) {

    // biz rules can override the cart settings to hide paypal checkout,
    // but it cannot show if the cart says no.  end of story.
    if (cart.hasPayPal && cart.amazonOrderReferenceId == null && !loggedIntoAmazon) {
      jQuery('#ucPayPalCheckoutSection').show();
      showConjunction = true;
    } else {
      jQuery('#ucPayPalCheckoutSection').hide();

    }

    // show the image no matter what.  it will show disabled if need be.
    // but only put in the click event if the cart is compatible.

    var paypalImage = jQuery('#paypalImage');
    if (cart.payPalButtonUrl && (paypalImage.attr('src') != cart.payPalButtonUrl)) {
      paypalImage.attr('src', cart.payPalButtonUrl);
      paypalImage.attr('alt', cart.payPalButtonAltText);
    }

    if (cart.payPalCompatible) {
      payPalLink.bind('click.ultraCart', payPalCheckout).addClass('fake_hyper');
    }
  }


  // ------------------------------------------------------------
  // Amazon Section
  if (cart != null) {

    if (cart.hasAmazon && amazonIsReady) {

      if (loggedIntoAmazon) {
        jQuery('#AmazonNote').html("<button onclick='stopUsingPayWithAmazon()'>Stop Using Pay with Amazon</button>");
      } else {
        showAmazonButton(cart.amazonButtonUrl);
        jQuery("#AmazonPayButton").show();
        if (cart.amazonOrderReferenceId) {
          jQuery('#AmazonNote').html("<em>Please login to Amazon again to continue.</em>");
        }
      }


    } else {
      jQuery("#AmazonPayButton,#AmazonNote").hide();
    }


  }


  if (showConjunction && cart.amazonOrderReferenceId == null) {
    jQuery('#ucPaymentConjunction').show();
  } else {
    jQuery('#ucPaymentConjunction').hide();
  }


  // finally, if we're in an Amazon transaction, make sure these sections are also hidden
  if (cart.amazonOrderReferenceId != null) {
    jQuery('#creditCardContainer,#billingDifferentContainer,.addressSection').hide();
  } else {
    jQuery('#creditCardContainer,#billingDifferentContainer,.addressSection').show();

    // Enable Hosted Fields
    if(window.setupSecureCreditCardFields){
      window.setupSecureCreditCardFields();
    }
  }


  // assign popups to any popup links on the page.
  jQuery('#cvv2popup').unbind().bind('click', makePopup('https://secure.ultracart.com/checkout/cvv2/both.jsp', "scrollbars,resizable,toolbar,width=600,height=450,left=50,top=50"));
}


function showAmazonButton(buttonUrl) {
  jQuery('#AmazonPayButton').html(
          '<' + 'img src="' + buttonUrl + '?sellerId=' + amazonMerchantId + '&size=large&color=orange" style="cursor: pointer;"/>'
  );


  //noinspection JSUnusedGlobalSymbols
  new OffAmazonPayments.Widgets.Button({
    sellerId: amazonMerchantId,
    useAmazonAddressBook: true,
    onSignIn: function (orderReference) {
      loggedIntoAmazon = true;
      jQuery('#AmazonPayButton').hide();
      jQuery('#AmazonNote').html(''); // do this here so that the refresh doesn't slam the note to the left before hiding it.
      disableFinalizeButton();
      cart.amazonOrderReferenceId = orderReference.getAmazonOrderReferenceId();
      cart.paymentMethod = "Amazon";

      showAmazonAddress();
      updateCart(); // this will trigger a refresh which will show the address and wallet.

    },
    onError: function (error) {
      renderErrors([error]);
    }
  }).bind("AmazonPayButton");

}


function showAmazonAddress() {

  //noinspection JSUnusedGlobalSymbols
  new OffAmazonPayments.Widgets.AddressBook({
    sellerId: amazonMerchantId,
    amazonOrderReferenceId: cart.amazonOrderReferenceId,
    onAddressSelect: function (orderReference) {
      estimateShipping();
      showAmazonWallet();
    },
    design: {
      size: {width: '400px', height: '260px'}
    },
    onError: function (error) {
      renderError([error]);
    }
  }).bind("AddressBookWidgetDiv");

}

function showAmazonWallet() {
  //noinspection JSUnusedGlobalSymbols
  new OffAmazonPayments.Widgets.Wallet({
    sellerId: amazonMerchantId,
    amazonOrderReferenceId: cart.amazonOrderReferenceId,
    design: {
      size: {width: '400px', height: '260px'}
    },
    onPaymentSelect: function (orderReference) {
      enableFinalizeButton();
    },
    onError: function (error) {
      console.log(error);
    }
  }).bind("AmazonWalletWidgetDiv");

}


function stopUsingPayWithAmazon() {
  cart.amazonOrderReferenceId = null;
  loggedIntoAmazon = false;
  jQuery('#AddressBookWidgetDiv,#AmazonWalletWidgetDiv,#AmazonNote').html('');
  updateCart();
}


function enableFinalizeButton() {
  jQuery('#finalizeButton').attr('disabled', false);
}

function disableFinalizeButton() {
  jQuery('#finalizeButton').attr('disabled', true);
}


function copyAllElementValuesToCart() {
  jQuery('.ucFormField').each(function (idx, el) {
    cart[el.id] = jQuery(el).val();
  });

  if (!jQuery('#billingDifferent').is(":checked")) {
    cart.billToLastName = cart.shipToLastName;
    cart.billToFirstName = cart.shipToFirstName;
    cart.billToCompany = cart.shipToCompany;
    cart.billToAddress1 = cart.shipToAddress1;
    cart.billToAddress2 = cart.shipToAddress2;
    cart.billToCity = cart.shipToCity;
    cart.billToState = cart.shipToState;
    cart.billToCountry = cart.shipToCountry;
    cart.billToDayPhone = cart.shipToPhone;
    cart.billToPostalCode = cart.shipToPostalCode;
  }

}

function copyElementValueToCart(event) {
  var fieldName = event.target.id;
  cart[fieldName] = jQuery.trim(jQuery(event.target).val());

  if (jQuery(event.target).hasClass('affectsShippingEstimate')) {
    if (haveEnoughFieldsToEstimateShipping()) {
      estimateShipping();
    }
  }

}


function haveEnoughFieldsToEstimateShipping() {
  var result = false;
  if (cart != null) {
    // if these fields are populated, estimate the shipping
    result = cart.shipToCity && cart.shipToPostalCode && cart.shipToState && cart.shipToCountry;
  }

  return result;
}


function estimateShipping() {

  //noinspection JSUnusedLocalSymbols
  restWrapper.estimateShipping(cart, {
    success: function (availableShippingMethods) {
      shippingEstimates = availableShippingMethods;

      // if a shipping method hasn't been selected, select it now.  It will save grief later.
      if (!cart.shippingMethod && shippingEstimates && shippingEstimates.length) {
        cart.shippingMethod = shippingEstimates[0].name;
        cart.shippingHandling = shippingEstimates[0].cost;
      }

      refreshShipping();
      refreshSummary();
    },
    failure: function (jqXHR, textStatus, errorThrown) {
      var errorMsg = jqXHR.getResponseHeader('UC-REST-ERROR');
      if (errorMsg) {
        renderErrors([errorMsg]);
      }
    }

  });
}


function refreshShipping() {
  var choice = getShippingChoice();

  // unbind any existing options before overwriting to avoid leaks.
  //noinspection JSJQueryEfficiency
  jQuery('[name=shippingMethod]').unbind('.ultraCart');

  var html = '';
  if (shippingEstimates && shippingEstimates.length) {
    // the shipping estimate object works without modification for our shipping estimate template,
    // so instead of create a copy of the array, I'll just use the estimates directly in the template.

    // we're making a copy of the shippingEstimates to format the cost.
    var shippingMethods = [];
    if (shippingEstimates) {
      for (var i = 0; i < shippingEstimates.length; i++) {
        var estimateClone = {};
        jQuery.extend(estimateClone, shippingEstimates[i]);
        if (estimateClone) {
          estimateClone.cost = estimateClone.costLocalizedFormatted;
          shippingMethods.push(estimateClone);
        }
      }
    }


    html = templates.shippingMethods({'shippingMethods': shippingMethods});
  }

  jQuery('#shippingMethods').html(html).bind('click.ultraCart', chooseShipping);
  if (choice) {
    jQuery("[name=shippingMethod][value='" + choice.name + "']").attr('checked', 'checked');
  }
}


/**
 * behavior to take when email is required.
 */
function alertEmailRequired() {
  jQuery('#emailContainer').addClass('field_container_error');
  jQuery('#email').focus();
  alert('Your email is required.  Please provide it in this field.');
}


function alertEmailConfirmRequired() {
  jQuery('#emailConfirmContainer').addClass('field_container_error');
  jQuery('#emailConfirm').focus();
  alert('Please confirm your email by retyping it in the field provided.');
}


function alertEmailConfirmMismatch() {
  jQuery('#emailConfirmContainer').addClass('field_container_error');
  jQuery('#emailConfirm').focus();
  alert('Your email and email confirmation do not match.  Please retype your email address.');
}


// ===========================================================================
// Render Functions
// Merchant: If you can your page layout, these will need
// to change accordingly.
// ===========================================================================


/**
 * this is what's displayed when the cart is empty.  you could have a beautiful div and toggle visibility
 * instead, if you want.  totally customizable.
 */
function renderEmptyCart() {
  jQuery('#emptyCart').html('<h4>Your cart is currently empty.  Please click here to continue shopping.</h4>');
}


/**
 * updates the summary block showing subtotal, tax, shipping, and total
 */
function refreshSummary() {

  if (cart == null || !cart.items || !cart.items.length) {
    jQuery('#summaryContainer').hide();
    return;
  }

  //noinspection JSJQueryEfficiency
  jQuery('#summaryContainer').show();

  // shipping must be dealt with specially.  to prevent customers from gaming the system, there are several instances
  // where the price of shipping is reset.  So, when rendering, always lookup the shipping method and calculate the cost
  // from that rather than using the cart.shippingHandlingWithDiscount, although the latter would be simpler

  var totalTax = cart.taxLocalized;
  var shippingTotal = '&nbsp;'; // don't display anything if there's no choice
  var total = cart.subtotalWithDiscountLocalized + cart.taxLocalized;

  var shippingChoice = getShippingChoice();
  if (shippingChoice) {
    totalTax += shippingChoice.taxLocalized;
    if (shippingChoice.costLocalized == 0) {
      shippingTotal = '<strong>FREE Shipping!</strong>';
    } else {
      shippingTotal = shippingChoice.costLocalizedFormatted;
    }
    total += shippingChoice.costLocalized;
    total += shippingChoice.taxLocalized;
  }

  var totalFormatted = app.commonFunctions.formatMoney(total, cart.currencyCode);
  var totalTaxFormatted = app.commonFunctions.formatMoney(totalTax, cart.currencyCode);

  jQuery('#summarySubtotal').html("<div class='summaryLabel'>Subtotal:<\/div><div class='summaryField'>" + cart.subtotalWithDiscountLocalizedFormatted + "<\/div>");
  jQuery('#summaryTax').html("<div class='summaryLabel'>Tax:<\/div><div class='summaryField'>" + (totalTax == 0 ? "<span class='tax'>No Sales Tax!</span>" : totalTaxFormatted) + "<\/div>");
  jQuery('#summaryShipping').html("<div class='summaryLabel'>Shipping:<\/div><div class='summaryField'>" + shippingTotal + "<\/div>");
  jQuery('#summaryTotal').html("<div class='summaryLabel'>Total:<\/div><div class='summaryField'>" + totalFormatted + "<\/div>");
}


/**
 * see what the customer has selected for shipping choice.  check to make sure it's still a valid choice, since
 * the choice may not still be available.
 * See: http://docs.ultracart.com/display/ucdoc/UltraCart+REST+Checkout+API#UltraCartRESTCheckoutAPI-ShippingEstimate
 * @return a shippingEstimate object or null
 */
function getShippingChoice() {

  var result = null;

  if (cart != null) {
    var selectedMethod = cart.shippingMethod;
    if (selectedMethod && shippingEstimates && shippingEstimates.length) {
      for (var i = 0; i < shippingEstimates.length; i++) {
        if (selectedMethod == shippingEstimates[i].name) {
          result = shippingEstimates[i];
        }
      }
    }
  }

  if (result == null) {
    // try to get the first choice, which is always the cheapest.
    if (shippingEstimates && shippingEstimates.length) {
      result = shippingEstimates[0];
    }
  }

  return result;
}


/**
 * hides the error messages when the user acknowledges them.  This isn't really a render function, but
 * it's tied to the renderErrors function so it's included here to ensure it's not missed.
 */
function hideError() {
  jQuery('#error_container').hide();
}

/**
 * This function wraps many remote calls to display any errors returned from the server.
 * @param errors - string array of error messages
 */
function renderErrors(errors) {
  if (typeof errors == 'undefined' || errors == null) return false;
  if (!errors.length) return false;
  if (errors.length == 0) return false;

  var html = '<ul>';
  for (var i = 0; i < errors.length; i++) {
    html += '<li>' + errors[i] + '</li>';
  }
  html += '</ul>';

  jQuery('#error_messages').html(html);
  jQuery('#error_container').show();
  document.getElementById('error_container').scrollIntoView();

  return true;
}

/**
 * checks for any errors returned from the finalize method and displays them
 */
function handleCheckoutErrors() {

  var params = app.commonFunctions.parseHttpParameters();
  var serverErrors = params['error'];
  // look to remove any plus signs used to represent spaces (should be %20, but it is what it is)
  if(serverErrors && serverErrors.length){
    for(var i = 0; i < serverErrors.length; i++){
      if(serverErrors[i].indexOf('+') > -1){
        serverErrors[i] = serverErrors[i].replace(/\+/g, ' ');
      }
    }
    renderErrors(serverErrors);
  }

}


/**
 * updates the cart and hands off to the checkout.
 */
function finalizeOrder(checkoutMethod) {
  if (!finalizing) {

    // set to prevent multiple submissions
    finalizing = true;

    // reset any errors
    jQuery('.field_container_error').removeClass('field_container_error');

    var waitDiv = document.getElementById('pleaseWait');
    if (waitDiv) {
      waitDiv.scrollIntoView();
    }

    if (checkoutMethod) {
      cart.paymentMethod = checkoutMethod;
    }

    if (!cart.paymentMethod || cart.paymentMethod == 'Unknown') {
      cart.paymentMethod = 'Credit Card';
    }

    copyAllElementValuesToCart();

    restWrapper.checkout(cart, {
      success: function (checkoutResponse) {
        if (checkoutResponse.redirectToUrl) {
          finalizing = false;
          location.href = checkoutResponse.redirectToUrl;
        } else if (checkoutResponse.errors) {
          finalizing = false;
          renderErrors(checkoutResponse.errors);
        } else {
          finalizing = false;
          // ?? this should never happen.
        }

      },
      failure: function (jqXHR, textStatus, errorThrown) {
        var errorMsg = jqXHR.getResponseHeader('UC-REST-ERROR');
        if (errorMsg) {
          renderErrors([errorMsg]);
        }
        finalizing = false;
      }
    });


  } //end-if not finalizing
}

function payPalCheckout() {
  return finalizeOrder('PayPal');
}


/**
 * removes an item from the cart
 * @param position the position in the list of items
 */
function removeItem(position) {
  cart.items.splice(position, 1);
  updateCart(true);
}


function continueShopping() {
  location.href = continueShoppingUrl;
}


/**
 * updates the cart for any items that have changed quantities
 */
function updateQty() {
  var qtyFields = jQuery('[name=cartItemQty]');


  var quantities = [];
  var validationError = false;
  qtyFields.each(function (index, el) {
    if (!isUnsignedInteger(el.value)) {
      validationError = true;
    } else {
      quantities.push(parseInt(el.value));
    }
  });
  if (validationError) {
    alert("One or more fields contain an invalid number.  Please correct before continuing.");
    return;
  }

  var cartItems = cart.items;
  for (var i = 0; i < cartItems.length; i++) {
    cartItems[i].quantity = quantities[i];
  }

  updateCart(true);

}


/**
 * retrieves the thumbnail associated with the item and returns back <img> html code for it.
 * Note that there's a lot of different images associated with
 * a cart item, and this is function is most likely going to be an issue.
 * @param cartItem The cart item for which to return the image tag.
 */
function getCartItemImg(cartItem) {
  if (!cartItem.defaultThumbnailUrl) return getCartItemImgFromMultimedia(cartItem);
  return "<img alt='' src='" + cartItem.defaultThumbnailUrl + "' />";
}

function getCartItemImgFromMultimedia(cartItem) {
  if (!cartItem.multimedias) return "";

  var media = cartItem.multimedias;
  if (media.length > 0) {
    for (var i in media) {
      if (media.hasOwnProperty(i)) {
        if (media[i].type == "Image" && media[i].isDefault) {
          if (media[i].thumbnails && media[i].thumbnails.length > 0) {
            var thumbnail = media[i].thumbnails[0];

            var url = '';
            if (thumbnail.httpsUrl && thumbnail.httpUrl) {
              url = ((window.location.protocol == "https:") ? (thumbnail.httpsUrl || thumbnail.httpUrl) : thumbnail.httpUrl);
            } else if (thumbnail.httpUrl) {
              url = thumbnail.httpUrl;
            }

            return "<img alt='' width='"
                    + thumbnail.width
                    + "px' height='"
                    + thumbnail.height
                    + "px' src='"
                    + url
                    + "' />";
          }
        }
      }
    }
  }

  return "&nbsp;";
}


/**
 * applies a coupon to the cart.
 */
function applyCoupon() {
  var couponEntryField = jQuery('#couponCode');
  var couponCode = couponEntryField.val();
  if (couponCode && couponCode.trim().length > 0) {

    // See http://docs.ultracart.com/display/ucdoc/UltraCart+REST+Checkout+API#UltraCartRESTCheckoutAPI-CartCoupon
    cart.coupons.push({couponCode: couponCode});
    updateCart(true);

  }

  couponEntryField.val('');

}


/**
 * removes a coupon from the cart.
 * @param coupon - the coupon code
 */
function removeCoupon(coupon) {

  if (cart && cart.coupons && cart.coupons.length) {

    // See http://docs.ultracart.com/display/ucdoc/UltraCart+REST+Checkout+API#UltraCartRESTCheckoutAPI-CartCoupon
    for (var i = 0; i < cart.coupons.length; i++) {
      if (cart.coupons[i].couponCode == coupon) {
        cart.coupons.splice(i, 1);
        break;
      }
    }

    updateCart(true);

  }
}

function chooseShipping() {
  var shippingMethod = jQuery('[name=shippingMethod]:checked').val();
  cart.shippingMethod = shippingMethod;

  // find the cost and set that as well.  the server doesn't mess with cost until finalize to keep things fast.
  if (shippingEstimates && shippingEstimates.length) {
    for (var i = 0; i < shippingEstimates.length; i++) {
      if (shippingEstimates[i].name == shippingMethod) {
        cart.shippingHandling = shippingEstimates[i].cost;
      }
    }
  }

  updateCart(true);

}


// ===========================================================================
// Utility Functions
// ===========================================================================
function makePopup(url, opts) {
  function popup() {
    var popup = window.open(url, "popup", opts);
    popup.focus();
    return false;
  }

  return popup;
}

function isUnsignedInteger(s) {
  return (s.toString().search(/^[0-9]+$/) == 0);
}

function showHide(checkbox, divId) {
  jQuery('#' + divId).toggle(checkbox.checked);
}


function createCookie(name, value, days) {
  var expires = "";
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toGMTString();
  }
  document.cookie = name + "=" + value + expires + "; path=/";
}

function readCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

