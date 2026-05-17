var childProcess = require('child_process');
var liquidApi = require('./liquid-api');

var DEFAULT_WALLET_NAME = 'unito_buyer';
var DEFAULT_SIGNER_NAME = 'unito_signer';
var DEFAULT_POLICY_ASSET = '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49';

function getConfig() {
  return {
    walletName: process.env.LWK_WALLET_NAME || DEFAULT_WALLET_NAME,
    signerName: process.env.LWK_SIGNER_NAME || DEFAULT_SIGNER_NAME,
    mnemonic: process.env.LWK_MNEMONIC || '',
    network: process.env.LIQUID_NETWORK || 'liquidtestnet',
    policyAsset: process.env.LWK_POLICY_ASSET || DEFAULT_POLICY_ASSET
  };
}

function cliUnavailableError() {
  var error = new Error('lwk_cli non trovato. Installa LWK CLI con: cargo install lwk_cli');
  error.statusCode = 503;
  return error;
}

function invokeLwk(args) {
  return new Promise(function(resolve, reject) {
    childProcess.execFile('lwk_cli', args, {
      timeout: Number(process.env.LWK_CLI_TIMEOUT_MS || 30000),
      maxBuffer: 1024 * 1024 * 4
    }, function(error, stdout, stderr) {
      if (error) {
        if (error.code === 'ENOENT') {
          return reject(cliUnavailableError());
        }

        error.message = stderr || error.message;
        error.statusCode = error.statusCode || 502;
        return reject(error);
      }

      resolve(stdout.trim());
    });
  });
}

function parseCliOutput(output) {
  if (!output) {
    return {};
  }

  try {
    return JSON.parse(output);
  } catch (error) {
    return output;
  }
}

function ensureConfigured() {
  var config = getConfig();

  if (!config.mnemonic) {
    var error = new Error('LWK_MNEMONIC mancante: configura un mnemonic testnet nelle variabili ambiente');
    error.statusCode = 503;
    throw error;
  }

  return config;
}

function checkCli() {
  return invokeLwk(['--version']).then(function(output) {
    return {
      available: true,
      version: output
    };
  }).catch(function(error) {
    if (error.statusCode === 503) {
      return {
        available: false,
        error: error.message
      };
    }

    throw error;
  });
}

function getStatus() {
  var config = getConfig();

  return checkCli().then(function(cli) {
    return {
      configured: Boolean(config.mnemonic),
      cliAvailable: cli.available,
      cliVersion: cli.version,
      cliError: cli.error,
      walletName: config.walletName,
      signerName: config.signerName,
      network: config.network,
      lwkNetwork: liquidApi.getLwkNetworkName(config.network),
      policyAsset: config.policyAsset
    };
  });
}

function getReceiveAddress() {
  var config = ensureConfigured();

  return invokeLwk(['wallet', 'address', '-w', config.walletName]).then(function(output) {
    return parseCliOutput(output);
  });
}

function getBalance() {
  var config = ensureConfigured();

  return invokeLwk(['wallet', 'balance', '-w', config.walletName]).then(function(output) {
    return parseCliOutput(output);
  });
}

function buildRecipient(address, amountSats, assetId) {
  return address + ':' + amountSats + ':' + assetId;
}

function createPset(recipients) {
  var config = ensureConfigured();
  var args = ['wallet', 'send', '-w', config.walletName];

  recipients.forEach(function(recipient) {
    args.push('--recipient', buildRecipient(recipient.address, recipient.amountSats, recipient.assetId || config.policyAsset));
  });

  return invokeLwk(args).then(function(output) {
    var parsed = parseCliOutput(output);
    return parsed.pset || parsed.psetBase64 || parsed;
  });
}

function signPset(pset) {
  var config = ensureConfigured();

  if (!pset) {
    var error = new Error('pset obbligatoria');
    error.statusCode = 400;
    throw error;
  }

  return invokeLwk(['signer', 'sign', '-s', config.signerName, '--pset', pset]).then(function(output) {
    var parsed = parseCliOutput(output);
    return parsed.pset || parsed.signedPset || parsed;
  });
}

function broadcastPset(pset) {
  var config = ensureConfigured();

  if (!pset) {
    var error = new Error('signedPset obbligatoria');
    error.statusCode = 400;
    throw error;
  }

  return invokeLwk(['wallet', 'broadcast', '-w', config.walletName, '--pset', pset]).then(function(output) {
    var parsed = parseCliOutput(output);
    var txid = parsed.txid || parsed.transaction || parsed;

    return {
      txid: txid,
      explorerUrl: liquidApi.getExplorerTransactionUrl(txid, config.network)
    };
  });
}

module.exports = {
  getConfig: getConfig,
  getStatus: getStatus,
  getReceiveAddress: getReceiveAddress,
  getBalance: getBalance,
  createPset: createPset,
  signPset: signPset,
  broadcastPset: broadcastPset
};
