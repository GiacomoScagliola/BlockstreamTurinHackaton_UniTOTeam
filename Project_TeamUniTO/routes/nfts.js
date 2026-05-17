var express = require('express');
var router = express.Router();
var nftExamples = require('../data/nft-examples');
var liquidApi = require('../services/liquid-api');

router.get('/', function(req, res) {
  var nfts = nftExamples.map(function(nft) {
    var fileKind = 'asset';

    if (nft.fileType && nft.fileType.indexOf('image/') === 0) {
      fileKind = 'image';
    }

    if (nft.fileType && nft.fileType.indexOf('video/') === 0) {
      fileKind = 'video';
    }

    return Object.assign({}, nft, {
      fileKind: fileKind,
      mediaLabel: fileKind === 'video' ? 'VIDEO' : 'BOOK',
      shortPaymentHash: nft.paymentHash ? nft.paymentHash.slice(0, 12) + '...' + nft.paymentHash.slice(-8) : 'Non disponibile'
    });
  });

  res.render('nft-list', {
    title: 'NFT Liquid Book Market',
    nfts: nfts
  });
});

router.get('/liquid/:txid', function(req, res, next) {
  var network = req.query.network;

  liquidApi.getTransaction(req.params.txid, network)
    .then(function(transaction) {
      res.render('nft-details', liquidApi.mapTransactionToNftDetails(transaction, {
        title: 'NFT Liquid ' + req.params.txid.slice(0, 8)
      }, network));
    })
    .catch(next);
});

router.get('/:id', function(req, res, next) {
  var nft = nftExamples.find(function(example) {
    return example.id === req.params.id;
  });

  if (!nft) {
    return next();
  }

  res.render('nft-details', nft);
});

module.exports = router;
