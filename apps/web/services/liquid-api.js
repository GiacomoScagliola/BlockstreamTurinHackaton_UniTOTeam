var https = require("https");

var NETWORKS = {
    liquid: {
        apiBaseUrl: "https://blockstream.info/liquid/api",
        explorerBaseUrl: "https://blockstream.info/liquid",
        lwkName: "mainnet",
    },
    liquidtestnet: {
        apiBaseUrl: "https://blockstream.info/liquidtestnet/api",
        explorerBaseUrl: "https://blockstream.info/liquidtestnet",
        lwkName: "testnet",
    },
};

var NETWORK_ALIASES = {
    mainnet: "liquid",
    testnet: "liquidtestnet",
    liquid: "liquid",
    liquidtestnet: "liquidtestnet",
};

var DEFAULT_NETWORK = process.env.LIQUID_NETWORK || "liquidtestnet";
var REQUEST_TIMEOUT_MS = Number(process.env.LIQUID_API_TIMEOUT_MS || 10000);

function normalizeNetworkName(networkName) {
    var selectedNetwork = networkName || DEFAULT_NETWORK;
    return NETWORK_ALIASES[selectedNetwork] || selectedNetwork;
}

function getNetworkConfig(networkName) {
    var selectedNetwork = normalizeNetworkName(networkName);
    var config = NETWORKS[selectedNetwork];

    if (!config) {
        var error = new Error("Liquid network not supported: " + selectedNetwork);
        error.statusCode = 400;
        throw error;
    }

    return config;
}

function getLwkNetworkName(networkName) {
    return getNetworkConfig(networkName).lwkName;
}

function validateHex(value, label) {
    if (!/^[0-9a-fA-F]+$/.test(value)) {
        var error = new Error(label + " must be a hexadecimal string");
        error.statusCode = 400;
        throw error;
    }
}

function validateTxid(txid) {
    validateHex(txid, "txid");

    if (txid.length !== 64) {
        var error = new Error("txid must contain 64 hexadecimal characters");
        error.statusCode = 400;
        throw error;
    }
}

function validateAssetId(assetId) {
    validateHex(assetId, "assetId");

    if (assetId.length !== 64) {
        var error = new Error("assetId must contain 64 hexadecimal characters");
        error.statusCode = 400;
        throw error;
    }
}

function validateVout(vout) {
    var outputIndex = Number(vout);

    if (!Number.isInteger(outputIndex) || outputIndex < 0) {
        var error = new Error("vout must be a positive integer");
        error.statusCode = 400;
        throw error;
    }

    return outputIndex;
}

function validateAddress(address) {
    if (!/^[a-zA-Z0-9]+$/.test(address)) {
        var error = new Error("address contains invalid characters");
        error.statusCode = 400;
        throw error;
    }
}

function requestLiquidApi(pathname, options) {
    var requestOptions = options || {};
    var networkConfig = getNetworkConfig(requestOptions.network);
    var cleanPathname = pathname.replace(/^\/+/, "");
    var url = new URL(networkConfig.apiBaseUrl + "/" + cleanPathname);
    var body = requestOptions.body || null;

    return new Promise(function (resolve, reject) {
        var req = https.request(
            url,
            {
                method: requestOptions.method || "GET",
                headers: {
                    Accept: requestOptions.accept || "application/json",
                    "Content-Type": requestOptions.contentType || "application/json",
                },
                timeout: REQUEST_TIMEOUT_MS,
            },
            function (res) {
                var chunks = [];

                res.on("data", function (chunk) {
                    chunks.push(chunk);
                });

                res.on("end", function () {
                    var responseBody = Buffer.concat(chunks).toString("utf8");

                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        var error = new Error(responseBody || "Liquid API error");
                        error.statusCode = res.statusCode;
                        return reject(error);
                    }

                    resolve(responseBody);
                });
            },
        );

        req.on("timeout", function () {
            req.destroy(new Error("Liquid API timeout"));
        });

        req.on("error", reject);

        if (body) {
            req.write(body);
        }

        req.end();
    });
}

function getJson(pathname, network) {
    return requestLiquidApi(pathname, { network: network }).then(function (responseBody) {
        return JSON.parse(responseBody);
    });
}

function getTransaction(txid, network) {
    validateTxid(txid);
    return getJson("/tx/" + txid, network);
}

function getTransactionOutput(txid, vout, network) {
    return getTransaction(txid, network).then(function (transaction) {
        var outputIndex = validateVout(vout);
        var output = transaction.vout && transaction.vout[outputIndex];

        if (!output) {
            var error = new Error("Output not found for vout " + vout);
            error.statusCode = 404;
            throw error;
        }

        return {
            txid: txid,
            vout: outputIndex,
            scriptPubKey: output.scriptpubkey,
            scriptPubKeyAsm: output.scriptpubkey_asm,
            address: output.scriptpubkey_address,
            asset: output.asset || output.assetcommitment,
            value: output.value,
            formattedValue: formatSats(output.value),
            status: transaction.status,
        };
    });
}

function getTransactionPrevout(txid, vout, network) {
    return getTransaction(txid, network).then(function (transaction) {
        var outputIndex = validateVout(vout);
        var output = transaction.vout && transaction.vout[outputIndex];

        if (!output) {
            var error = new Error("Prevout not found for vout " + vout);
            error.statusCode = 404;
            throw error;
        }

        return Object.assign({}, output, {
            txid: txid,
            vout: outputIndex,
        });
    });
}

function getTransactionPrevouts(inputs, network) {
    if (!Array.isArray(inputs) || inputs.length === 0) {
        var error = new Error("inputs must be a non-empty array of { txid, vout }");
        error.statusCode = 400;
        throw error;
    }

    return Promise.all(
        inputs.map(function (input) {
            if (!input || typeof input !== "object") {
                var itemError = new Error("Each input must contain txid and vout");
                itemError.statusCode = 400;
                throw itemError;
            }

            return getTransactionPrevout(input.txid, input.vout, network);
        }),
    );
}

function getAddress(address, network) {
    validateAddress(address);
    return getJson("/address/" + address, network);
}

function getAddressTransactions(address, network) {
    validateAddress(address);
    return getJson("/address/" + address + "/txs", network);
}

function getAddressUtxos(address, network) {
    validateAddress(address);
    return getJson("/address/" + address + "/utxo", network);
}

function getAsset(assetId, network) {
    validateAssetId(assetId);
    return getJson("/asset/" + assetId, network);
}

function getAssetTransactions(assetId, network) {
    validateAssetId(assetId);
    return getJson("/asset/" + assetId + "/txs", network);
}

function broadcastTransaction(rawTx, network) {
    validateHex(rawTx, "rawTx");

    return requestLiquidApi("/tx", {
        method: "POST",
        body: rawTx,
        network: network,
        accept: "text/plain",
        contentType: "text/plain",
    });
}

function getExplorerTransactionUrl(txid, network) {
    validateTxid(txid);
    return getNetworkConfig(network).explorerBaseUrl + "/tx/" + txid;
}

function formatSats(value) {
    if (typeof value !== "number") {
        return "Confidential";
    }

    return (value / 100000000).toFixed(8) + " L-BTC";
}

function findIssuedAssetId(transaction) {
    var inputs = transaction.vin || [];

    for (var i = 0; i < inputs.length; i += 1) {
        if (inputs[i].issuance && inputs[i].issuance.asset_id) {
            return inputs[i].issuance.asset_id;
        }
    }

    return null;
}

function mapTransactionToNftDetails(transaction, metadata, network) {
    var nftMetadata = metadata || {};
    var issuedAssetId = findIssuedAssetId(transaction);
    var firstVisibleOutput = (transaction.vout || []).find(function (output) {
        return typeof output.value === "number";
    });

    return {
        title: nftMetadata.title || "NFT Liquid " + transaction.txid.slice(0, 8),
        paymentHash: transaction.txid,
        fileName: nftMetadata.fileName,
        fileUrl: nftMetadata.fileUrl,
        fileType: nftMetadata.fileType,
        fileSize: nftMetadata.fileSize,
        price: nftMetadata.price || (firstVisibleOutput ? formatSats(firstVisibleOutput.value) : null),
        minPrice: nftMetadata.minPrice,
        maxPrice: nftMetadata.maxPrice,
        royaltyPercentage: nftMetadata.royaltyPercentage,
        blockchain: {
            network: network || DEFAULT_NETWORK,
            txid: transaction.txid,
            confirmed: Boolean(transaction.status && transaction.status.confirmed),
            blockHeight: transaction.status && transaction.status.block_height,
            assetId: nftMetadata.assetId || issuedAssetId,
            explorerUrl: getExplorerTransactionUrl(transaction.txid, network),
        },
    };
}

module.exports = {
    NETWORKS: NETWORKS,
    NETWORK_ALIASES: NETWORK_ALIASES,
    DEFAULT_NETWORK: DEFAULT_NETWORK,
    normalizeNetworkName: normalizeNetworkName,
    getLwkNetworkName: getLwkNetworkName,
    getTransaction: getTransaction,
    getTransactionOutput: getTransactionOutput,
    getTransactionPrevout: getTransactionPrevout,
    getTransactionPrevouts: getTransactionPrevouts,
    getAddress: getAddress,
    getAddressTransactions: getAddressTransactions,
    getAddressUtxos: getAddressUtxos,
    getAsset: getAsset,
    getAssetTransactions: getAssetTransactions,
    broadcastTransaction: broadcastTransaction,
    getExplorerTransactionUrl: getExplorerTransactionUrl,
    mapTransactionToNftDetails: mapTransactionToNftDetails,
    formatSats: formatSats,
};
