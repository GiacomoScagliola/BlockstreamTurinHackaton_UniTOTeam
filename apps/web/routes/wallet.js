var express = require('express');
var router = express.Router();
var walletService = require('../services/wallet-service');
var simplicityContractService = require('../services/simplicity-contract-service');

function asyncRoute(handler) {
  return function(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

router.get('/status', asyncRoute(function(req, res) {
  return walletService.getStatus().then(function(status) {
    res.json(status);
  });
}));

router.get('/address', asyncRoute(function(req, res) {
  return walletService.getReceiveAddress().then(function(address) {
    res.json(address);
  });
}));

router.get('/balance', asyncRoute(function(req, res) {
  return walletService.getBalance().then(function(balance) {
    res.json(balance);
  });
}));

router.get('/contract-status', function(req, res) {
  res.json(simplicityContractService.getStatus());
});

router.use(function(err, req, res, next) {
  res.status(err.statusCode || 500).json({
    error: err.message
  });
});

module.exports = router;
