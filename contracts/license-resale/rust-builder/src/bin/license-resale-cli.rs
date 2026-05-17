use std::fs;
use std::str::FromStr;

use license_resale_covenant::{
    LicenseResaleContract, LicenseResaleParameters, ResaleTerms, explicit_txout, explicit_utxo,
};
use serde::{Deserialize, Serialize};
use simplex::provider::SimplicityNetwork;
use simplex::simplicityhl::elements::secp256k1_zkp::XOnlyPublicKey;
use simplex::simplicityhl::elements::{AssetId, OutPoint, Script, Txid};

#[derive(Debug, Deserialize)]
struct PrepareResaleRequest {
    network: Option<String>,
    license_asset_id: String,
    payment_asset_id: String,
    creator_pubkey: String,
    seller_pubkey: String,
    buyer_pubkey: String,
    min_resale_price: u64,
    max_resale_price: u64,
    royalty_bps: u64,
    sale_price: u64,
    sold_license_copies: u64,
    fee_amount: u64,
    license_utxo: UtxoInput,
    payment_utxo: UtxoInput,
}

#[derive(Debug, Deserialize)]
struct UtxoInput {
    txid: String,
    vout: u32,
    amount: u64,
    asset_id: String,
    script_pubkey_hex: Option<String>,
}

#[derive(Debug, Serialize)]
struct CliResponse {
    pset: String,
    mode: &'static str,
    required_signers: Vec<&'static str>,
    summary: CliSummary,
}

#[derive(Debug, Serialize)]
struct CliSummary {
    sale_price: u64,
    sold_license_copies: u64,
    seller_amount: u64,
    author_royalty: u64,
    buyer_change: u64,
    remaining_license_copies: u64,
    fee_amount: u64,
    covenant_output_index: u32,
    seller_change_output_index: u32,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() != 3 || args[1] != "prepare-resale" {
        return Err("usage: license-resale-cli prepare-resale <request.json>".into());
    }

    let raw = fs::read_to_string(&args[2])?;
    let request: PrepareResaleRequest = serde_json::from_str(&raw)?;
    let response = prepare_resale(request)?;

    println!("{}", serde_json::to_string_pretty(&response)?);
    Ok(())
}

fn prepare_resale(request: PrepareResaleRequest) -> Result<CliResponse, Box<dyn std::error::Error>> {
    let network = parse_network(request.network.as_deref());
    let seller_pubkey = parse_xonly(&request.seller_pubkey)?;
    let buyer_pubkey = parse_xonly(&request.buyer_pubkey)?;

    let params = LicenseResaleParameters {
        license_asset_id: parse_asset_id(&request.license_asset_id)?,
        payment_asset_id: parse_asset_id(&request.payment_asset_id)?,
        creator_pubkey: parse_xonly(&request.creator_pubkey)?,
        min_resale_price: request.min_resale_price,
        max_resale_price: request.max_resale_price,
        royalty_bps: request.royalty_bps,
    };
    let contract = LicenseResaleContract::new(params);

    let license_script = request
        .license_utxo
        .script_pubkey_hex
        .as_deref()
        .map(parse_script)
        .transpose()?
        .unwrap_or_else(|| contract.covenant_script_for_owner(seller_pubkey, &network));
    let payment_script = request
        .payment_utxo
        .script_pubkey_hex
        .as_deref()
        .map(parse_script)
        .transpose()?
        .unwrap_or_else(|| LicenseResaleContract::direct_key_script(buyer_pubkey));

    let license_utxo = make_utxo(&request.license_utxo, license_script)?;
    let payment_utxo = make_utxo(&request.payment_utxo, payment_script)?;
    let terms = ResaleTerms {
        sale_price: request.sale_price,
        sold_license_copies: request.sold_license_copies,
        fee_amount: request.fee_amount,
    };

    let unsigned = contract.build_unsigned_resale(
        license_utxo,
        payment_utxo,
        seller_pubkey,
        buyer_pubkey,
        terms,
        &network,
    )?;

    Ok(CliResponse {
        pset: unsigned.pst.to_string(),
        mode: "simplicity-rust",
        required_signers: vec!["seller", "buyer"],
        summary: CliSummary {
            sale_price: terms.sale_price,
            sold_license_copies: terms.sold_license_copies,
            seller_amount: unsigned.amounts.seller_payment,
            author_royalty: unsigned.amounts.royalty_payment,
            buyer_change: unsigned.amounts.buyer_change,
            remaining_license_copies: unsigned.amounts.remaining_license_copies,
            fee_amount: terms.fee_amount,
            covenant_output_index: 0,
            seller_change_output_index: 1,
        },
    })
}

fn parse_network(network: Option<&str>) -> SimplicityNetwork {
    match network.unwrap_or("liquidtestnet") {
        "liquid" | "mainnet" => SimplicityNetwork::Liquid,
        "liquidregtest" | "regtest" => SimplicityNetwork::default_regtest(),
        _ => SimplicityNetwork::LiquidTestnet,
    }
}

fn make_utxo(input: &UtxoInput, script: Script) -> Result<simplex::transaction::UTXO, Box<dyn std::error::Error>> {
    Ok(explicit_utxo(
        OutPoint::new(Txid::from_str(strip_0x(&input.txid))?, input.vout),
        explicit_txout(script, input.amount, parse_asset_id(&input.asset_id)?),
    ))
}

fn parse_asset_id(value: &str) -> Result<AssetId, Box<dyn std::error::Error>> {
    Ok(AssetId::from_str(strip_0x(value))?)
}

fn parse_xonly(value: &str) -> Result<XOnlyPublicKey, Box<dyn std::error::Error>> {
    Ok(XOnlyPublicKey::from_str(strip_0x(value))?)
}

fn parse_script(value: &str) -> Result<Script, Box<dyn std::error::Error>> {
    Ok(Script::from(hex(value)?))
}

fn hex(value: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let clean = strip_0x(value);

    if clean.len() % 2 != 0 {
        return Err("hex string must have an even length".into());
    }

    let mut out = Vec::with_capacity(clean.len() / 2);
    for i in (0..clean.len()).step_by(2) {
        out.push(u8::from_str_radix(&clean[i..i + 2], 16)?);
    }
    Ok(out)
}

fn strip_0x(value: &str) -> &str {
    value.strip_prefix("0x").unwrap_or(value)
}
