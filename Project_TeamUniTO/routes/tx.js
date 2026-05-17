var express = require('express');
var router = express.Router();
var walletService = require('../services/wallet-service');

function asyncRoute(handler) {
  return function(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.post('/broadcast', asyncRoute(function(req, res) {
  return walletService.broadcastPset(req.body.signedPset).then(function(result) {
    res.json(result);
  });
}));

router.post('/sign', asyncRoute(function(req, res) {
  return walletService.signPset(req.body.pset).then(function(signedPset) {
    res.json({
      signedPset: signedPset
    });
  });
}));

router.use(function(err, req, res, next) {
  res.status(err.statusCode || 500).json({
    error: err.message
  });
});

module.exports = router;
