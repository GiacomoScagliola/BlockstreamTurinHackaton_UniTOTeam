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
    var error = new Error(label + ' is required');
    error.statusCode = 400;
    throw error;
  }

  return value;
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

router.get('/', function(req, res) {
  res.json({
    books: marketplace.books.map(function(book) {
      return {
        id: book.id,
        title: book.title,
        author: book.authorName,
        price: book.initialPrice,
        assetId: book.bookAssetId,
        paymentAssetId: book.paymentAssetId,
        copiesRemaining: book.copiesRemaining
      };
    })
  });
});

router.post('/:bookId/buy/prepare', asyncRoute(function(req, res) {
  var book = getBookOrFail(req.params.bookId);
  var buyerAddress = requireString(req.body.buyerAddress, 'buyerAddress');
  var split = royalty.primarySplit(book.initialPrice);
  var recipients = [
    {
      address: book.authorAddress,
      amountSats: split.author,
      assetId: book.paymentAssetId
    }
  ];

  var psetPromise = req.body.createLiquidPset === true
    ? walletService.createPset(recipients)
    : Promise.resolve(mockPset('primary_sale', book.id));

  return psetPromise.then(function(pset) {
    res.json({
      pset: pset,
      requiredSigners: ['buyer'],
      mode: req.body.createLiquidPset === true ? 'liquid' : 'mock',
      summary: {
        bookId: book.id,
        buyerAddress: buyerAddress,
        price: book.initialPrice,
        authorAmount: split.author,
        siteAmount: split.site,
        bookOutputIndex: 1,
        outputOrder: [
          'BookSaleContract stock - 1',
          'BookCopyContract buyer',
          'Author payment',
          'Buyer change'
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
