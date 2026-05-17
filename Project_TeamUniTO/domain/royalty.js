function toSats(value, label) {
  var amount = Number(value);

  if (!Number.isInteger(amount) || amount < 0) {
    var error = new Error((label || 'amount') + ' must be a positive integer in sats');
    error.statusCode = 400;
    throw error;
  }

  return amount;
}

function primarySplit(price) {
  var amount = toSats(price, 'price');

  return {
    author: amount,
    site: 0
  };
}

function resaleSplit(price, royaltyBps) {
  var amount = toSats(price, 'price');
  var bps = Number.isInteger(royaltyBps) ? royaltyBps : 1500;
  var author = Math.floor((amount * bps) / 10000);
  var seller = amount - author;

  return {
    seller: seller,
    author: author,
    site: 0
  };
}

function getResaleRange(lastSalePrice) {
  var amount = toSats(lastSalePrice, 'lastSalePrice');

  return {
    min: Math.floor((amount * 80) / 100),
    max: Math.floor((amount * 120) / 100)
  };
}

function getContractResaleRange(book, lastSalePrice) {
  var fallback = getResaleRange(lastSalePrice);
  var min = Number(book && book.minResalePrice);
  var max = Number(book && book.maxResalePrice);

  return {
    min: Number.isInteger(min) ? min : fallback.min,
    max: Number.isInteger(max) ? max : fallback.max
  };
}

function assertValidContractResalePrice(book, lastSalePrice, newPrice) {
  var amount = toSats(newPrice, 'newPrice');
  var range = getContractResaleRange(book, lastSalePrice);

  if (amount < range.min || amount > range.max) {
    var error = new Error('Invalid resale price. Allowed range: ' + range.min + '-' + range.max);
    error.statusCode = 400;
    throw error;
  }

  return true;
}

module.exports = {
  primarySplit: primarySplit,
  resaleSplit: resaleSplit,
  getResaleRange: getResaleRange,
  getContractResaleRange: getContractResaleRange,
  assertValidContractResalePrice: assertValidContractResalePrice,
  toSats: toSats
};
