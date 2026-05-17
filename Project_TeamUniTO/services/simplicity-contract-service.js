var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');

var CONTRACT_DIR = process.env.LICENSE_RESALE_CONTRACT_DIR ||
  path.resolve(__dirname, '..', '..', 'Smart_contract', 'license-resale-covenant-rust');

var DEFAULT_BUYER_PUBKEY = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';

function getCargoCommand() {
  return process.env.CARGO_PATH || 'cargo';
}

function ensureString(value, label) {
  if (!value || typeof value !== 'string') {
    var error = new Error(label + ' obbligatorio per il builder Simplicity');
    error.statusCode = 400;
    throw error;
  }

  return value;
}

function ensureUtxo(value, label) {
  if (!value || typeof value !== 'object') {
    var error = new Error(label + ' obbligatorio per il builder Simplicity');
    error.statusCode = 400;
    throw error;
  }

  return value;
}

function numberOrDefault(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : Number(value);
}

function contractNumberOrDefault(value, fallback) {
  var amount = Number(value);
  return Number.isInteger(amount) ? amount : fallback;
}

function writeTempJson(payload) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-resale-'));
  var file = path.join(dir, 'request.json');
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return {
    dir: dir,
    file: file
  };
}

function cleanupTemp(temp) {
  if (!temp || !temp.dir) return;

  try {
    fs.rmSync(temp.dir, { recursive: true, force: true });
  } catch (error) {
    // Temp cleanup should not hide the real builder result.
  }
}

function invokeRustBuilder(payload) {
  var temp = writeTempJson(payload);

  return new Promise(function(resolve, reject) {
    childProcess.execFile(
      getCargoCommand(),
      [
        'run',
        '--quiet',
        '--manifest-path',
        path.join(CONTRACT_DIR, 'Cargo.toml'),
        '--bin',
        'license-resale-cli',
        '--',
        'prepare-resale',
        temp.file
      ],
      {
        cwd: CONTRACT_DIR,
        timeout: Number(process.env.SIMPLICITY_BUILDER_TIMEOUT_MS || 120000),
        maxBuffer: 1024 * 1024 * 8,
        env: Object.assign({}, process.env)
      },
      function(error, stdout, stderr) {
        cleanupTemp(temp);

        if (error) {
          error.message = stderr || error.message;
          error.statusCode = error.statusCode || 502;
          return reject(error);
        }

        try {
          resolve(JSON.parse(stdout));
        } catch (parseError) {
          parseError.message = 'Risposta Rust non valida: ' + parseError.message;
          parseError.statusCode = 502;
          reject(parseError);
        }
      }
    );
  });
}

function buildDemoPaymentUtxo(book, listing, requestBody) {
  var provided = requestBody && requestBody.buyerPaymentUtxo;

  if (provided) {
    return provided;
  }

  return {
    txid: '2222222222222222222222222222222222222222222222222222222222222222',
    vout: 1,
    amount: Number(listing.price) + numberOrDefault(requestBody.feeAmount, 500) + 10000,
    asset_id: book.paymentAssetId
  };
}

function buildResaleRequest(book, copy, listing, requestBody) {
  var body = requestBody || {};
  var licenseUtxo = ensureUtxo(body.licenseUtxo || copy.contractUtxoDetails, 'licenseUtxo');
  var paymentUtxo = ensureUtxo(buildDemoPaymentUtxo(book, listing, body), 'buyerPaymentUtxo');
  var lastSalePrice = Number(copy.lastSalePrice);

  return {
    network: process.env.LIQUID_NETWORK || 'liquidtestnet',
    license_asset_id: ensureString(book.bookAssetId, 'book.bookAssetId'),
    payment_asset_id: ensureString(book.paymentAssetId, 'book.paymentAssetId'),
    creator_pubkey: ensureString(book.authorPubkey, 'book.authorPubkey'),
    seller_pubkey: ensureString(listing.sellerPubkey || copy.currentOwnerPubkey, 'sellerPubkey'),
    buyer_pubkey: ensureString(body.buyerPubkey || DEFAULT_BUYER_PUBKEY, 'buyerPubkey'),
    min_resale_price: contractNumberOrDefault(book.minResalePrice, Math.floor((lastSalePrice * 80) / 100)),
    max_resale_price: contractNumberOrDefault(book.maxResalePrice, Math.floor((lastSalePrice * 120) / 100)),
    royalty_bps: contractNumberOrDefault(book.royaltyBps, 1500),
    sale_price: Number(listing.price),
    sold_license_copies: numberOrDefault(body.soldLicenseCopies, 1),
    fee_amount: numberOrDefault(body.feeAmount, 500),
    license_utxo: {
      txid: ensureString(licenseUtxo.txid, 'licenseUtxo.txid'),
      vout: Number(licenseUtxo.vout || 0),
      amount: Number(licenseUtxo.amount || 1),
      asset_id: licenseUtxo.asset_id || licenseUtxo.assetId || book.bookAssetId,
      script_pubkey_hex: licenseUtxo.script_pubkey_hex || licenseUtxo.scriptPubKeyHex
    },
    payment_utxo: {
      txid: ensureString(paymentUtxo.txid, 'buyerPaymentUtxo.txid'),
      vout: Number(paymentUtxo.vout || 0),
      amount: Number(paymentUtxo.amount || paymentUtxo.amountSats),
      asset_id: paymentUtxo.asset_id || paymentUtxo.assetId || book.paymentAssetId,
      script_pubkey_hex: paymentUtxo.script_pubkey_hex || paymentUtxo.scriptPubKeyHex
    }
  };
}

function prepareResale(book, copy, listing, requestBody) {
  return invokeRustBuilder(buildResaleRequest(book, copy, listing, requestBody));
}

function getStatus() {
  return {
    contractDir: CONTRACT_DIR,
    cargoCommand: getCargoCommand(),
    available: fs.existsSync(path.join(CONTRACT_DIR, 'Cargo.toml'))
  };
}

module.exports = {
  prepareResale: prepareResale,
  getStatus: getStatus
};
