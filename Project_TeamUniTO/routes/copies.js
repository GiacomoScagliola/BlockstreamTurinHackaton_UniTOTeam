var express = require('express');
var router = express.Router();
var marketplace = require('../data/book-marketplace');
var royalty = require('../domain/royalty');

function getCopyOrFail(copyId) {
  var copy = marketplace.findCopy(copyId);

  if (!copy) {
    var error = new Error('Copia non trovata');
    error.statusCode = 404;
    throw error;
  }

  return copy;
}

router.post('/:copyId/list', function(req, res, next) {
  try {
    var copy = getCopyOrFail(req.params.copyId);
    var price = royalty.toSats(req.body.price, 'price');
    var range = royalty.getResaleRange(copy.lastSalePrice);

    royalty.assertValidResalePrice(copy.lastSalePrice, price);

    var listingId = 'listing_' + Date.now();
    var listing = marketplace.addListing({
      id: listingId,
      listingId: listingId,
      copyId: copy.id,
      sellerAddress: req.body.sellerAddress || copy.currentOwnerAddress,
      sellerScriptHash: copy.currentOwnerScriptHash,
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
