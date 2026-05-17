var express = require('express');
var router = express.Router();
var nftExamples = require('../data/nft-examples');

router.get('/', function(req, res) {
  res.redirect('/nfts/' + nftExamples[0].id);
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
