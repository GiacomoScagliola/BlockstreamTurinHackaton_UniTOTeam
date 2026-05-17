function toSats(value, label) {
  var amount = Number(value);

  if (!Number.isInteger(amount) || amount < 0) {
    var error = new Error((label || 'amount') + ' deve essere un intero positivo in sats');
    error.statusCode = 400;
    throw error;
  }

  return amount;
}

function primarySplit(price) {
  var amount = toSats(price, 'price');
  var author = Math.floor((amount * 90) / 100);
  var site = amount - author;

  return {
    author: author,
    site: site
  };
}

function resaleSplit(price) {
  var amount = toSats(price, 'price');
  var seller = Math.floor((amount * 80) / 100);
  var author = Math.floor((amount * 15) / 100);
  var site = amount - seller - author;

  return {
    seller: seller,
    author: author,
    site: site
  };
}

function getResaleRange(lastSalePrice) {
  var amount = toSats(lastSalePrice, 'lastSalePrice');

  return {
    min: Math.floor((amount * 80) / 100),
    max: Math.floor((amount * 120) / 100)
  };
}

function assertValidResalePrice(lastSalePrice, newPrice) {
  var amount = toSats(newPrice, 'newPrice');
  var range = getResaleRange(lastSalePrice);

  if (amount < range.min || amount > range.max) {
    var error = new Error('Prezzo rivendita non valido. Range consentito: ' + range.min + '-' + range.max);
    error.statusCode = 400;
    throw error;
  }

  return true;
}

module.exports = {
  primarySplit: primarySplit,
  resaleSplit: resaleSplit,
  getResaleRange: getResaleRange,
  assertValidResalePrice: assertValidResalePrice,
  toSats: toSats
};
