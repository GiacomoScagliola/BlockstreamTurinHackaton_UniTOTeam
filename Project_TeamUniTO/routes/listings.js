var express = require('express');
var router = express.Router();
var marketplace = require('../data/book-marketplace');
var royalty = require('../domain/royalty');
var walletService = require('../services/wallet-service');

function asyncRoute(handler) {
  return function(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function requireString(value, label) {
  if (!value || typeof value !== 'string') {
    var error = new Error(label + ' obbligatorio');
    error.statusCode = 400;
    throw error;
  }

  return value;
}

function getListingOrFail(listingId) {
  var listing = marketplace.findListing(listingId);

  if (!listing) {
    var error = new Error('Listing non trovato');
    error.statusCode = 404;
    throw error;
  }

  return listing;
}

function getCopyOrFail(copyId) {
  var copy = marketplace.findCopy(copyId);

  if (!copy) {
    var error = new Error('Copia non trovata');
    error.statusCode = 404;
    throw error;
  }

  return copy;
}

function getBookOrFail(bookId) {
  var book = marketplace.findBook(bookId);

  if (!book) {
    var error = new Error('Libro non trovato');
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
  var range = royalty.getResaleRange(copy.lastSalePrice);
  var split = royalty.resaleSplit(listing.price);

  royalty.assertValidResalePrice(copy.lastSalePrice, listing.price);

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
    },
    {
      address: book.siteAddress,
      amountSats: split.site,
      assetId: book.paymentAssetId
    }
  ];

  var psetPromise = req.body.createLiquidPset === true
    ? walletService.createPset(recipients)
    : Promise.resolve(mockPset('resale', listing.id));

  return psetPromise.then(function(pset) {
    res.json({
      pset: pset,
      requiredSigners: ['seller', 'buyer'],
      mode: req.body.createLiquidPset === true ? 'liquid' : 'mock',
      summary: {
        listingId: listing.id,
        copyId: copy.id,
        bookId: book.id,
        buyerAddress: buyerAddress,
        price: listing.price,
        validPriceRange: range,
        sellerAmount: split.seller,
        authorRoyalty: split.author,
        siteFee: split.site,
        outputOrder: [
          'BookCopyContract nuovo buyer',
          'Pagamento vecchio owner',
          'Royalty autore',
          'Fee sito',
          'Resto buyer'
        ]
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
