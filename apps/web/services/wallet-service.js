var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');
var os = require('os');
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
  var error = new Error('lwk_cli was not found. Install it with: cargo install lwk_cli, or set LWK_CLI_PATH=' + path.join(getCargoBinPath(), 'lwk_cli'));
  error.statusCode = 503;
  return error;
}

function getCargoBinPath() {
  return path.join(os.homedir(), '.cargo', 'bin');
}

function getLwkCliCommand() {
  var configuredPath = process.env.LWK_CLI_PATH;

  if (configuredPath) {
    return configuredPath;
  }

  var cargoCliPath = path.join(getCargoBinPath(), 'lwk_cli');

  if (fs.existsSync(cargoCliPath)) {
    return cargoCliPath;
  }

  return 'lwk_cli';
}

function getCliEnvironment() {
  var env = Object.assign({}, process.env);
  var cargoBinPath = getCargoBinPath();
  var pathEntries = (env.PATH || '').split(path.delimiter);
  env.NETWORK = liquidApi.getLwkNetworkName(env.LIQUID_NETWORK || 'liquidtestnet');

  if (pathEntries.indexOf(cargoBinPath) === -1) {
    pathEntries.unshift(cargoBinPath);
    env.PATH = pathEntries.filter(Boolean).join(path.delimiter);
  }

  return env;
}

function invokeLwk(args) {
  return new Promise(function(resolve, reject) {
    childProcess.execFile(getLwkCliCommand(), args, {
      env: getCliEnvironment(),
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
  return getConfig();
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

function containsName(output, name) {
  var parsed = parseCliOutput(output);

  if (Array.isArray(parsed)) {
    return parsed.some(function(item) {
      return item === name || item.name === name || item.walletName === name || item.signerName === name;
    });
  }

  if (parsed && typeof parsed === 'object') {
    return Object.keys(parsed).some(function(key) {
      var value = parsed[key];
      return key === name || value === name || value.name === name || value.walletName === name || value.signerName === name;
    });
  }

  return String(output || '').indexOf(name) !== -1;
}

function shortError(error) {
  return String(error && error.message ? error.message : error)
    .split(/\r?\n/)
    .filter(Boolean)[0];
}

function checkLoadedResource(kind, name) {
  return invokeLwk([kind, 'list']).then(function(output) {
    return {
      available: true,
      loaded: containsName(output, name),
      raw: parseCliOutput(output)
    };
  }).catch(function(error) {
    return {
      available: false,
      loaded: false,
      error: shortError(error)
    };
  });
}

function getStatus() {
  var config = getConfig();

  return Promise.all([
    checkCli(),
    checkLoadedResource('wallet', config.walletName),
    checkLoadedResource('signer', config.signerName)
  ]).then(function(results) {
    var cli = results[0];
    var wallet = results[1];
    var signer = results[2];

    return {
      configured: Boolean(cli.available && wallet.loaded && signer.loaded),
      cliAvailable: cli.available,
      cliVersion: cli.version,
      cliError: cli.error,
      serverAvailable: wallet.available || signer.available,
      serverError: wallet.error || signer.error,
      walletLoaded: wallet.loaded,
      signerLoaded: signer.loaded,
      walletName: config.walletName,
      signerName: config.signerName,
      network: config.network,
      lwkNetwork: liquidApi.getLwkNetworkName(config.network),
      policyAsset: config.policyAsset,
      needsMnemonic: !config.mnemonic,
      setupHint: 'Start the LWK RPC server, then load wallet "' + config.walletName + '" and signer "' + config.signerName + '".'
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
    var error = new Error('pset is required');
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
    var error = new Error('signedPset is required');
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
