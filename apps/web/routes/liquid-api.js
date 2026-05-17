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
 * @brief Restituisce le reti Liquid supportate dal client interno.
 * @route GET /api/liquid/networks
 * @return {Object} Configurazione delle reti e rete di default.
 */
router.get('/networks', function(req, res) {
  res.json({
    defaultNetwork: liquidApi.DEFAULT_NETWORK,
    aliases: liquidApi.NETWORK_ALIASES,
    networks: liquidApi.NETWORKS
  });
});

/**
 * @brief Recupera i dettagli completi di una transazione Liquid.
 * @route GET /api/liquid/tx/:txid
 * @param {string} txid - Identificativo esadecimale della transazione.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Object} Transazione nel formato restituito da Esplora.
 */
router.get('/tx/:txid', asyncRoute(function(req, res) {
  return liquidApi.getTransaction(req.params.txid, getNetwork(req)).then(function(transaction) {
    res.json(transaction);
  });
}));

/**
 * @brief Recupera un output specifico di una transazione Liquid.
 * @route GET /api/liquid/tx/:txid/output/:vout
 * @param {string} txid - Identificativo esadecimale della transazione.
 * @param {number} vout - Indice dell'output da leggere.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Object} Output normalizzato con script, address, asset e valore.
 */
router.get('/tx/:txid/output/:vout', asyncRoute(function(req, res) {
  return liquidApi.getTransactionOutput(req.params.txid, req.params.vout, getNetwork(req)).then(function(output) {
    res.json(output);
  });
}));

/**
 * @brief Recupera un prevout raw in formato EsploraVout per la finalizzazione Simplicity.
 * @route GET /api/liquid/tx/:txid/prevout/:vout
 * @param {string} txid - Identificativo esadecimale della transazione che contiene l'output.
 * @param {number} vout - Indice dell'output da usare come prevout.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Object} Output raw Esplora arricchito con txid e vout.
 */
router.get('/tx/:txid/prevout/:vout', asyncRoute(function(req, res) {
  return liquidApi.getTransactionPrevout(req.params.txid, req.params.vout, getNetwork(req)).then(function(prevout) {
    res.json(prevout);
  });
}));

/**
 * @brief Recupera una lista ordinata di prevout raw EsploraVout per finalizeSimplicityInputs.
 * @route POST /api/liquid/prevouts
 * @body {Array<Object>} inputs - Lista ordinata di input nel formato { txid, vout }.
 * @body {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @query {string} [network] - Rete alternativa se non viene passata nel body.
 * @return {Object} Rete LWK normalizzata e array prevouts nello stesso ordine degli input.
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
 * @brief Converte una transazione Liquid in dati pronti per la vista dettaglio NFT.
 * @route GET /api/liquid/tx/:txid/nft-details
 * @param {string} txid - Identificativo esadecimale della transazione.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Object} Dati NFT normalizzati per il template nft-details.hbs.
 */
router.get('/tx/:txid/nft-details', asyncRoute(function(req, res) {
  return liquidApi.getTransaction(req.params.txid, getNetwork(req)).then(function(transaction) {
    res.json(liquidApi.mapTransactionToNftDetails(transaction, {}, getNetwork(req)));
  });
}));

/**
 * @brief Trasmette una transazione raw sulla rete Liquid selezionata.
 * @route POST /api/liquid/tx
 * @body {string} rawTx - Transazione raw in formato esadecimale.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Object} Identificativo della transazione trasmessa.
 */
router.post('/tx', asyncRoute(function(req, res) {
  return liquidApi.broadcastTransaction(req.body.rawTx, getNetwork(req)).then(function(txid) {
    res.status(201).json({ txid: txid });
  });
}));

/**
 * @brief Recupera statistiche e riepilogo di un indirizzo Liquid.
 * @route GET /api/liquid/address/:address
 * @param {string} address - Indirizzo Liquid o Liquid Testnet.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Object} Informazioni address con chain_stats e mempool_stats.
 */
router.get('/address/:address', asyncRoute(function(req, res) {
  return liquidApi.getAddress(req.params.address, getNetwork(req)).then(function(addressInfo) {
    res.json(addressInfo);
  });
}));

/**
 * @brief Recupera la lista delle transazioni associate a un indirizzo Liquid.
 * @route GET /api/liquid/address/:address/txs
 * @param {string} address - Indirizzo Liquid o Liquid Testnet.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Array<Object>} Transazioni associate all'indirizzo.
 */
router.get('/address/:address/txs', asyncRoute(function(req, res) {
  return liquidApi.getAddressTransactions(req.params.address, getNetwork(req)).then(function(transactions) {
    res.json(transactions);
  });
}));

/**
 * @brief Recupera gli UTXO disponibili per un indirizzo Liquid.
 * @route GET /api/liquid/address/:address/utxos
 * @param {string} address - Indirizzo Liquid o Liquid Testnet.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Array<Object>} Lista degli output non spesi associati all'indirizzo.
 */
router.get('/address/:address/utxos', asyncRoute(function(req, res) {
  return liquidApi.getAddressUtxos(req.params.address, getNetwork(req)).then(function(utxos) {
    res.json(utxos);
  });
}));

/**
 * @brief Recupera le informazioni di un asset Liquid.
 * @route GET /api/liquid/asset/:assetId
 * @param {string} assetId - Identificativo esadecimale dell'asset Liquid.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Object} Metadati e statistiche dell'asset.
 */
router.get('/asset/:assetId', asyncRoute(function(req, res) {
  return liquidApi.getAsset(req.params.assetId, getNetwork(req)).then(function(asset) {
    res.json(asset);
  });
}));

/**
 * @brief Recupera le transazioni di issuance, reissuance o burn associate a un asset.
 * @route GET /api/liquid/asset/:assetId/txs
 * @param {string} assetId - Identificativo esadecimale dell'asset Liquid.
 * @query {string} [network] - Rete da usare: testnet/mainnet oppure liquidtestnet/liquid.
 * @return {Array<Object>} Transazioni associate all'asset.
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
