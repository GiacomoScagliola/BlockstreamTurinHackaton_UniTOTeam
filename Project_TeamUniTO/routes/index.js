var express = require('express');
var router = express.Router();
var marketplace = require('../data/book-marketplace');
var walletService = require('../services/wallet-service');

function formatSats(amount) {
  return Number(amount || 0).toLocaleString('en-US') + ' sats';
}

function royaltyPercent(book) {
  return (Number(book.royaltyBps || 0) / 100).toLocaleString('en-US') + '%';
}

function activeListings() {
  return marketplace.listings.filter(function(listing) {
    return listing.status === 'active';
  }).map(function(listing) {
    var copy = marketplace.findCopy(listing.copyId);
    var book = copy && marketplace.findBook(copy.bookId);

    return {
      id: listing.id,
      copyId: listing.copyId,
      bookId: book && book.id,
      title: book && book.title,
      sellerAddress: listing.sellerAddress,
      sellerPubkey: listing.sellerPubkey,
      price: listing.price,
      priceLabel: formatSats(listing.price),
      royaltyLabel: book ? royaltyPercent(book) : '0%',
      minPriceLabel: book ? formatSats(book.minResalePrice) : '',
      maxPriceLabel: book ? formatSats(book.maxResalePrice) : ''
    };
  });
}

function ownedCopies() {
  return marketplace.copies.map(function(copy) {
    var book = marketplace.findBook(copy.bookId);

    return {
      id: copy.id,
      bookId: copy.bookId,
      title: book && book.title,
      ownerAddress: copy.currentOwnerAddress,
      ownerPubkey: copy.currentOwnerPubkey,
      lastSalePriceLabel: formatSats(copy.lastSalePrice),
      minPrice: book && book.minResalePrice,
      maxPrice: book && book.maxResalePrice,
      minPriceLabel: book ? formatSats(book.minResalePrice) : '',
      maxPriceLabel: book ? formatSats(book.maxResalePrice) : '',
      status: copy.status
    };
  });
}

function marketViewModel() {
  return {
    title: 'Liquid Book Market',
    books: marketplace.books.map(function(book) {
      return {
        id: book.id,
        title: book.title,
        authorName: book.authorName,
        initialPrice: book.initialPrice,
        initialPriceLabel: formatSats(book.initialPrice),
        copiesRemaining: book.copiesRemaining,
        royaltyLabel: royaltyPercent(book),
        minPriceLabel: formatSats(book.minResalePrice),
        maxPriceLabel: formatSats(book.maxResalePrice),
        paymentAssetId: book.paymentAssetId,
        bookAssetId: book.bookAssetId
      };
    }),
    listings: activeListings(),
    copies: ownedCopies()
  };
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', marketViewModel());
});

router.get('/wallet', function(req, res, next) {
  walletService.getStatus().then(function(status) {
    res.render('wallet', {
      title: 'Wallet',
      status: status
    });
  }).catch(next);
});

module.exports = router;
