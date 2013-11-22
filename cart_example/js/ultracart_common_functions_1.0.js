var app = {commonFunctions: {}};


app.commonFunctions.storeCard = function (cart, callback) {

  // Extract the card number from the field
  var cardNumber = cart.creditCardNumber || '';
  var merchantId = cart.merchantId;
  var cartId = cart.cartId;

  // If they haven't specified 15 digits yet then don't store it.
  if (cardNumber.replace(/[^0-9]/g, "").length < 15) {
    return;
  }

  if (!merchantId || !cartId) {
    return;
  }


  // Perform the JSONP request to store it (asynchronous by nature)
  jQuery.getJSON('https://secure.ultracart.com/cgi-bin/UCCheckoutAPICardStore?callback=?',
          {
            merchantId: merchantId,
            shoppingCartId: cartId,
            cardNumber: cardNumber
          }
  ).done(function (data) {
            if (data.success) {
              cart.creditCardNumber = data.maskedCardNumber;
              if(callback){
                callback();
              }
            }
          });
};


app.commonFunctions.isYesValue = function (val) {
  if (!val) {
    val = false; // take care of nulls and undefined.
  }
  if (typeof val == 'string') {
    val = val.toLowerCase();
    return "yes" == val || "true" == val || "on" == val || "Y" == val || "1" == val;
  }
  return val;
};


/**
 * parses the query parameters of the page and returns them in a usable hash.
 * @return a hash of arrays with the key = parameter name, and the array equal to the values
 */
app.commonFunctions.parseHttpParameters = function () {
  var result = {};
  var searchString = window.location.search.substring(1), params = searchString.split("&");
  for (var i = 0; i < params.length; i++) {
    var kv = params[i].split("=");
    var name = kv[0].toLowerCase(), value = decodeURIComponent(kv[1]);

    if (!result.hasOwnProperty(name)) {
      result[name] = [];
    }
    result[name].push(value);

  }
  return result;
};


/**
 * this method should only be called after the cart has loaded.
 * see: http://docs.ultracart.com/display/ucdoc/Parameters+that+can+be+passed+to+UCEditor
 * UCEditor is the old original static cgi script for UltraCart.  it accepted numerous query parameters to manipulate the cart
 * This function attempts to mimic that behavior.
 * @param cart
 * @return {boolean} true if changes were made to cart, else false.
 */
app.commonFunctions.pretendToBeUCEditor = function (cart) {

  // note: all params are key=string, value=array, but most always we only need the first value.
  // so you'll see [0] tacked onto every value reference, such as params[propertyName][0]. just fyi.

  var needToSave = false;

  var params = app.commonFunctions.parseHttpParameters();
  var simpleProperties = {
    advertisingsource: 'advertisingSource',
    billingfirstname: 'billToFirstName',
    billinglastname: 'billToLastName',
    billingcompany: 'billToCompany',
    billingaddress1: 'billToAddress1',
    billingaddress2: 'billToAddress2',
    billingcity: 'billToCity',
    billingstate: 'billToState',
    billingpostalcode: 'billToPostalCode',
    billingcountry: 'billToCountry',
    billingdayphone: 'billToDayPhone',
    billingeveningphone: 'billToEveningPhone',
    ccemail: 'ccEmail',
    shippingfirstname: 'shipToFirstName',
    shippinglastname: 'shipToLastName',
    shippingcompany: 'shipToCompany',
    shippingaddress1: 'shipToAddress1',
    shippingaddress2: 'shipToAddress2',
    shippingcity: 'shipToCity',
    shippingstate: 'shipToState',
    shippingpostalcode: 'shipToPostalCode',
    shippingcountry: 'shipToCountry',
    shippingdayphone: 'shipToPhone',
    customfield1: 'customField1',
    customfield2: 'customField2',
    customfield3: 'customField3',
    customfield4: 'customField4',
    customfield5: 'customField5',
    customfield6: 'customField6',
    customfield7: 'customField7',
    creditcardtype: 'creditCardType',
    creditcardnumber: 'creditCardNumber',
    creditcardexpmonth: 'creditCardExpirationMonth',
    creditcardexpyear: 'creditCardExpirationYear',
    creditcardcvv2: 'creditCardToken',
    shippingmethod: 'shippingMethod',
    themecode: 'screenBrandingThemeCode'
  };

  for (var propertyName in simpleProperties) {
    if (simpleProperties.hasOwnProperty(propertyName)) {
      if (params.hasOwnProperty(propertyName)) {
        cart[simpleProperties[propertyName]] = params[propertyName][0];
        needToSave = true;
      }
    }
  }


  var copyS_to_B = false;
  var copyB_to_S = false;

  if (params.hasOwnProperty('billingsameasshipping') && app.commonFunctions.isYesValue(params['billingsameasshipping'])) {
    copyS_to_B = true;
    needToSave = true;
  }

  if (params.hasOwnProperty('defaultbillingsameasshipping') && app.commonFunctions.isYesValue(params['billingdifferent'])) {
    copyS_to_B = true;
    needToSave = true;
  }

  if (params.hasOwnProperty('defaultshippingsameasbilling') && app.commonFunctions.isYesValue(params['shippingdifferent'])) {
    copyB_to_S = true;
    needToSave = true;
  }

  if (copyS_to_B) {
    cart.billToLastName = cart.shipToLastName;
    cart.billToFirstName = cart.shipToFirstName;
    cart.billToCompany = cart.shipToCompany;
    cart.billToAddress1 = cart.shipToAddress1;
    cart.billToAddress2 = cart.shipToAddress2;
    cart.billToCity = cart.shipToCity;
    cart.billToState = cart.shipToState;
    cart.billToCountry = cart.shipToCountry;
    needToSave = true;
  }
  if (copyB_to_S) {
    cart.shipToLastName = cart.billToLastName;
    cart.shipToFirstName = cart.billToFirstName;
    cart.shipToCompany = cart.billToCompany;
    cart.shipToAddress1 = cart.billToAddress1;
    cart.shipToAddress2 = cart.billToAddress2;
    cart.shipToCity = cart.billToCity;
    cart.shipToState = cart.billToState;
    cart.shipToCountry = cart.billToCountry;
    needToSave = true;
  }


  // need to populate both email and confirm, so can't treat email as simple property.
  if (params.hasOwnProperty("email")) {
    cart['email'] = params['email'][0];
    cart['emailConfirm'] = params['email'][0];
    needToSave = true;
  }

  if (params.hasOwnProperty("shippingresidentialaddress")) {
    cart['shipToResidential'] = app.commonFunctions.isYesValue(params['shippingresidentialaddress'][0]);
    needToSave = true;
  }


  var itemsChanged = false;
  var items = cart.items || [];
  if (params.hasOwnProperty("clearcart")) {
    itemsChanged = true;
    items = [];
  }

  if (params.hasOwnProperty(('add'))) {
    itemsChanged = true;
    var qty = 1;
    if (params.quantity) {
      qty = parseInt(params['quantity'][0]);
    }
    if (isNaN(qty)) {
      qty = 1;
    }
    var item = {itemId: params['add'][0], quantity: qty};
    // check for options
    for (var i = 1; i <= 10; i++) {
      if (params.hasOwnProperty('optionname' + i) && params.hasOwnProperty('optionvalue' + i)) {
        // we have items, make sure options property is initialized.
        if (!item.hasOwnProperty('options')) {
          item['options'] = [];
        }
        item.options.push({name: params['optionname' + i][0], selectedValue: params['optionvalue' + i][0]});
      }
    }

    items.push(item);
  }

  // check for multiple items.  Look for "add_" parameters.
  for (var parameterName in params) {
    if (params.hasOwnProperty(parameterName) && parameterName.indexOf('add_') == 0) {
      var quantity = parseInt(params[parameterName][0]);
      var itemId = parameterName.substring('add_'.length);
      itemsChanged = true;
      items.push({itemId: itemId, quantity: quantity});
    }
  }

  if (itemsChanged) {
    cart['items'] = items;
    needToSave = true;
  }

  var couponsChanged = false;
  var coupons = cart.coupons || [];
  if (params.hasOwnProperty('coupon')) {
    var couponCodes = params['coupon'];
    _.each(couponCodes, function (code) {
      if (!_.contains(_.pluck(coupons, 'couponCode'), code)) {
        coupons.push({'couponCode': code});
        couponsChanged = true;
      }
    });
  }

  if (couponsChanged) {
    attr['coupons'] = coupons;
    needToSave = true;
  }


  return needToSave;

//  if (params.hasOwnProperty('overridecatalogurl')) {
//    window.continueShoppingUrl = params['overridecatalogurl'];
//  }
//  if (params.hasOwnProperty('overridecontinueshoppingurl')) {
//    window.continueShoppingUrl = params['overridecontinueshoppingurl'];
//  }

};