var express = require('express');
var router = express.Router();
var liquidApi = require('../services/liquid-api');

function asyncRoute(handler) {
  return function(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function getNetwork(req) {
  return req.query.network || req.body.network;
}

/**
 * @brief Returns the Liquid networks supported by the internal client.
 * @route GET /api/liquid/networks
 * @return {Object} Network configuration and default network.
 */
router.get('/networks', function(req, res) {
  res.json({
    defaultNetwork: liquidApi.DEFAULT_NETWORK,
    aliases: liquidApi.NETWORK_ALIASES,
    networks: liquidApi.NETWORKS
  });
});

/**
 * @brief Retrieves the full details of a Liquid transaction.
 * @route GET /api/liquid/tx/:txid
 * @param {string} txid - Hexadecimal transaction identifier.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Object} Transaction in the format returned by Esplora.
 */
router.get('/tx/:txid', asyncRoute(function(req, res) {
  return liquidApi.getTransaction(req.params.txid, getNetwork(req)).then(function(transaction) {
    res.json(transaction);
  });
}));

/**
 * @brief Retrieves a specific output of a Liquid transaction.
 * @route GET /api/liquid/tx/:txid/output/:vout
 * @param {string} txid - Hexadecimal transaction identifier.
 * @param {number} vout - Index of the output to read.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Object} Normalized output with script, address, asset, and value.
 */
router.get('/tx/:txid/output/:vout', asyncRoute(function(req, res) {
  return liquidApi.getTransactionOutput(req.params.txid, req.params.vout, getNetwork(req)).then(function(output) {
    res.json(output);
  });
}));

/**
 * @brief Retrieves a raw prevout in EsploraVout format for Simplicity finalization.
 * @route GET /api/liquid/tx/:txid/prevout/:vout
 * @param {string} txid - Hexadecimal identifier of the transaction containing the output.
 * @param {number} vout - Index of the output to use as prevout.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Object} Raw Esplora output enriched with txid and vout.
 */
router.get('/tx/:txid/prevout/:vout', asyncRoute(function(req, res) {
  return liquidApi.getTransactionPrevout(req.params.txid, req.params.vout, getNetwork(req)).then(function(prevout) {
    res.json(prevout);
  });
}));

/**
 * @brief Retrieves an ordered list of raw EsploraVout prevouts for finalizeSimplicityInputs.
 * @route POST /api/liquid/prevouts
 * @body {Array<Object>} inputs - Ordered list of inputs in the format { txid, vout }.
 * @body {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @query {string} [network] - Alternative network if not passed in the body.
 * @return {Object} Normalized LWK network and prevouts array in the same order as inputs.
 */
router.post('/prevouts', asyncRoute(function(req, res) {
  return liquidApi.getTransactionPrevouts(req.body.inputs, getNetwork(req)).then(function(prevouts) {
    res.json({
      network: liquidApi.getLwkNetworkName(getNetwork(req)),
      prevouts: prevouts
    });
  });
}));

/**
 * @brief Converts a Liquid transaction into data ready for the NFT detail view.
 * @route GET /api/liquid/tx/:txid/nft-details
 * @param {string} txid - Hexadecimal transaction identifier.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Object} Normalized NFT data for the nft-details.hbs template.
 */
router.get('/tx/:txid/nft-details', asyncRoute(function(req, res) {
  return liquidApi.getTransaction(req.params.txid, getNetwork(req)).then(function(transaction) {
    res.json(liquidApi.mapTransactionToNftDetails(transaction, {}, getNetwork(req)));
  });
}));

/**
 * @brief Broadcasts a raw transaction on the selected Liquid network.
 * @route POST /api/liquid/tx
 * @body {string} rawTx - Raw transaction in hexadecimal format.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Object} Identifier of the broadcasted transaction.
 */
router.post('/tx', asyncRoute(function(req, res) {
  return liquidApi.broadcastTransaction(req.body.rawTx, getNetwork(req)).then(function(txid) {
    res.status(201).json({ txid: txid });
  });
}));

/**
 * @brief Retrieves statistics and summary for a Liquid address.
 * @route GET /api/liquid/address/:address
 * @param {string} address - Liquid or Liquid Testnet address.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Object} Address information with chain_stats and mempool_stats.
 */
router.get('/address/:address', asyncRoute(function(req, res) {
  return liquidApi.getAddress(req.params.address, getNetwork(req)).then(function(addressInfo) {
    res.json(addressInfo);
  });
}));

/**
 * @brief Retrieves the list of transactions associated with a Liquid address.
 * @route GET /api/liquid/address/:address/txs
 * @param {string} address - Liquid or Liquid Testnet address.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Array<Object>} Transactions associated with the address.
 */
router.get('/address/:address/txs', asyncRoute(function(req, res) {
  return liquidApi.getAddressTransactions(req.params.address, getNetwork(req)).then(function(transactions) {
    res.json(transactions);
  });
}));

/**
 * @brief Retrieves the available UTXOs for a Liquid address.
 * @route GET /api/liquid/address/:address/utxos
 * @param {string} address - Liquid or Liquid Testnet address.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Array<Object>} List of unspent outputs associated with the address.
 */
router.get('/address/:address/utxos', asyncRoute(function(req, res) {
  return liquidApi.getAddressUtxos(req.params.address, getNetwork(req)).then(function(utxos) {
    res.json(utxos);
  });
}));

/**
 * @brief Retrieves information for a Liquid asset.
 * @route GET /api/liquid/asset/:assetId
 * @param {string} assetId - Hexadecimal identifier of the Liquid asset.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Object} Asset metadata and statistics.
 */
router.get('/asset/:assetId', asyncRoute(function(req, res) {
  return liquidApi.getAsset(req.params.assetId, getNetwork(req)).then(function(asset) {
    res.json(asset);
  });
}));

/**
 * @brief Retrieves issuance, reissuance, or burn transactions associated with an asset.
 * @route GET /api/liquid/asset/:assetId/txs
 * @param {string} assetId - Hexadecimal identifier of the Liquid asset.
 * @query {string} [network] - Network to use: testnet/mainnet or liquidtestnet/liquid.
 * @return {Array<Object>} Transactions associated with the asset.
 */
router.get('/asset/:assetId/txs', asyncRoute(function(req, res) {
  return liquidApi.getAssetTransactions(req.params.assetId, getNetwork(req)).then(function(transactions) {
    res.json(transactions);
  });
}));

router.use(function(err, req, res, next) {
  res.status(err.statusCode || 502).json({
    error: err.message || 'Liquid communication failed'
  });
});

module.exports = router;
