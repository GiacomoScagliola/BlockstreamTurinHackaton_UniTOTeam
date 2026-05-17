var express = require('express');
var router = express.Router();
var marketplace = require('../data/book-marketplace');
var royalty = require('../domain/royalty');
var walletService = require('../services/wallet-service');
var simplicityContractService = require('../services/simplicity-contract-service');

function asyncRoute(handler) {
  return function(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function requireString(value, label) {
  if (!value || typeof value !== 'string') {
    var error = new Error(label + ' is required');
    error.statusCode = 400;
    throw error;
  }

  return value;
}

function getListingOrFail(listingId) {
  var listing = marketplace.findListing(listingId);

  if (!listing) {
    var error = new Error('Listing not found');
    error.statusCode = 404;
    throw error;
  }

  return listing;
}

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

function mockPset(prefix, id) {
  return 'mock_' + prefix + '_pset_' + id + '_' + Date.now();
}

router.post('/:listingId/buy/prepare', asyncRoute(function(req, res) {
  var listing = getListingOrFail(req.params.listingId);
  var copy = getCopyOrFail(listing.copyId);
  var book = getBookOrFail(copy.bookId);
  var buyerAddress = requireString(req.body.buyerAddress, 'buyerAddress');
  var range = royalty.getContractResaleRange(book, copy.lastSalePrice);
  var split = royalty.resaleSplit(listing.price, book.royaltyBps);

  royalty.assertValidContractResalePrice(book, copy.lastSalePrice, listing.price);

  var recipients = [
    {
      address: listing.sellerAddress || copy.currentOwnerAddress,
      amountSats: split.seller,
      assetId: book.paymentAssetId
    },
    {
      address: book.authorAddress,
      amountSats: split.author,
      assetId: book.paymentAssetId
    }
  ];

  var useSimplicityBuilder = req.body.createSimplicityPset === true || req.body.mode === 'simplicity';
  var psetPromise = useSimplicityBuilder
    ? simplicityContractService.prepareResale(book, copy, listing, req.body)
    : req.body.createLiquidPset === true
    ? walletService.createPset(recipients)
    : Promise.resolve(mockPset('resale', listing.id));

  return psetPromise.then(function(builderResult) {
    var isSimplicity = builderResult && builderResult.mode === 'simplicity-rust';
    var pset = isSimplicity ? builderResult.pset : builderResult;
    var contractSummary = isSimplicity ? builderResult.summary : null;
    var outputOrder = [
      'BookCopyContract for buyer',
      'BookCopyContract seller remainder',
      'Previous owner payment',
      'Author royalty',
      'Buyer change'
    ];

    if (contractSummary && contractSummary.fee_amount > 0) {
      outputOrder.push('Liquid fee');
    }

    res.json({
      pset: pset,
      requiredSigners: ['seller', 'buyer'],
      mode: isSimplicity ? 'simplicity-rust' : req.body.createLiquidPset === true ? 'liquid' : 'mock',
      summary: {
        listingId: listing.id,
        copyId: copy.id,
        bookId: book.id,
        buyerAddress: buyerAddress,
        buyerPubkey: req.body.buyerPubkey,
        price: listing.price,
        validPriceRange: range,
        sellerAmount: contractSummary ? contractSummary.seller_amount : split.seller,
        authorRoyalty: contractSummary ? contractSummary.author_royalty : split.author,
        siteFee: 0,
        buyerChange: contractSummary && contractSummary.buyer_change,
        feeAmount: contractSummary && contractSummary.fee_amount,
        remainingLicenseCopies: contractSummary && contractSummary.remaining_license_copies,
        outputOrder: outputOrder,
        covenant: isSimplicity ? contractSummary : null
      }
    });
  });
}));

router.use(function(err, req, res, next) {
  res.status(err.statusCode || 500).json({
    error: err.message
  });
});

module.exports = router;
