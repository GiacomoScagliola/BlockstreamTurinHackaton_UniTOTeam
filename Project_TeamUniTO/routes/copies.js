var express = require('express');
var router = express.Router();
var marketplace = require('../data/book-marketplace');
var royalty = require('../domain/royalty');

function getCopyOrFail(copyId) {
  var copy = marketplace.findCopy(copyId);

  if (!copy) {
    var error = new Error('Copy not found');
    error.statusCode = 404;
    throw error;
  }

  return copy;
}

function getBookOrFail(bookId) {
  var book = marketplace.findBook(bookId);

  if (!book) {
    var error = new Error('Book not found');
    error.statusCode = 404;
    throw error;
  }

  return book;
}

router.post('/:copyId/list', function(req, res, next) {
  try {
    var copy = getCopyOrFail(req.params.copyId);
    var book = getBookOrFail(copy.bookId);
    var price = royalty.toSats(req.body.price, 'price');
    var range = royalty.getContractResaleRange(book, copy.lastSalePrice);

    royalty.assertValidContractResalePrice(book, copy.lastSalePrice, price);

    var listingId = 'listing_' + Date.now();
    var listing = marketplace.addListing({
      id: listingId,
      listingId: listingId,
      copyId: copy.id,
      sellerAddress: req.body.sellerAddress || copy.currentOwnerAddress,
      sellerScriptHash: copy.currentOwnerScriptHash,
      sellerPubkey: copy.currentOwnerPubkey,
      price: price,
      status: 'active'
    });

    res.json({
      listingId: listing.id,
      validPriceRange: range,
      listing: listing
    });
  } catch (error) {
    next(error);
  }
});

router.use(function(err, req, res, next) {
  res.status(err.statusCode || 500).json({
    error: err.message
  });
});

module.exports = router;
