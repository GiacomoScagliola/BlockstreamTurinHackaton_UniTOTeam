# Liquid License Market

A hackathon prototype for a Liquid digital-license marketplace backed by a Simplicity resale covenant.

The app lets an author mint/sell digital book-license tokens, lets owners list copies for resale, and prepares covenant-valid Liquid PSETs for secondary sales. The contract is the source of truth: when UI or backend assumptions differ from the covenant rules, the UI/backend must change.

## What Is Implemented

- Express web demo with English market, wallet, NFT, buy, and sell screens.
- Primary sale mock flow for buying new book-license tokens.
- Secondary-sale flow backed by the Rust Simplicity covenant builder.
- LWK CLI integration points for wallet status, signing, PSET creation, and broadcast.
- SimplicityHL covenant for non-confidential Liquid resale transactions.
- Rust builder crate that builds strict 2-input resale PSETs and finalizes the Simplicity covenant input.

## Repository Layout

```text
BlockstreamTurinHackaton_UniTOTeam/
|-- apps/
|   `-- web/                         Express + Handlebars marketplace demo
|       |-- routes/                   HTTP routes for books, copies, listings, wallet, tx
|       |-- services/                 LWK, Liquid API, and Simplicity builder bridges
|       |-- views/                    English UI templates
|       |-- public/                   CSS and browser-side form wiring
|       `-- data/                     In-memory demo marketplace state
|
|-- contracts/
|   `-- license-resale/
|       |-- simplicity/               Canonical SimplicityHL source and examples
|       |-- rust-builder/             Rust/LWK-compatible PSET builder crate
|       `-- README.md                 Contract-specific notes
|
|-- docs/
|   |-- simplicity_liquid_license_resale_brief.md
|   `-- original_project_notes.md
|
|-- config/
|   `-- local/                        Ignored local secrets, API keys, and machine config
|
|-- .gitignore
`-- README.md
```

## Contract Rules

The resale covenant currently enforces this transaction shape:

```text
Input 0: seller's license covenant UTXO
Input 1: buyer payment UTXO

Output 0: sold license copies locked to covenant(owner = buyer)
Output 1: remaining license copies locked to covenant(owner = seller)
Output 2: seller payment
Output 3: author royalty
Output 4: buyer payment change
Output 5: optional Liquid fee output
```

Important rules:

- Assets and values must be explicit, not confidential.
- `LICENSE_ASSET_ID`, `PAYMENT_ASSET_ID`, `CREATOR_PUBKEY`, `MIN_RESALE_PRICE`, `MAX_RESALE_PRICE`, and `ROYALTY_BPS` are author-chosen genesis parameters.
- The current seller must sign.
- The sale price must stay inside the author-defined min/max caps.
- Seller receives `sale_price - royalty`.
- Author receives `sale_price * ROYALTY_BPS / 10000`.
- Site/platform fee is not part of the covenant; the UI reports it as `0`.
- If a Liquid fee output exists, the fee is paid from the buyer payment input.

## Quick Start

Install Node dependencies:

```bash
cd apps/web
npm install
```

Run the web app:

```bash
npm start
```

Open:

```text
http://127.0.0.1:3000
```

If port `3000` is already in use:

```powershell
$env:PORT=3010; npm start
```

## Rust Builder

Run tests:

```bash
cd contracts/license-resale/rust-builder
cargo test
```

Prepare a sample resale PSET:

```bash
cargo run --bin license-resale-cli -- prepare-resale examples/prepare-resale.sample.json
```

The CLI returns JSON with:

- base64 PSET
- mode: `simplicity-rust`
- required signers: seller and buyer
- covenant summary with seller amount, royalty, change, remaining copies, and fee

## Web App Integration

The web app calls the Rust builder from:

```text
apps/web/services/simplicity-contract-service.js
```

Default builder path:

```text
contracts/license-resale/rust-builder
```

Override it with:

```bash
LICENSE_RESALE_CONTRACT_DIR=/absolute/path/to/rust-builder
```

Main API endpoints:

```http
GET  /
GET  /wallet
GET  /api/wallet/status
GET  /api/wallet/contract-status
POST /api/books/:bookId/buy/prepare
POST /api/copies/:copyId/list
POST /api/listings/:listingId/buy/prepare
POST /api/tx/sign
POST /api/tx/broadcast
```

## LWK Setup

The wallet page checks:

- `lwk_cli` availability
- LWK RPC server availability
- configured wallet name
- configured signer name
- network and policy asset

Default names:

```text
wallet: unito_buyer
signer: unito_signer
network: liquidtestnet
```

Useful environment variables:

```bash
LWK_CLI_PATH=/path/to/lwk_cli
LWK_WALLET_NAME=unito_buyer
LWK_SIGNER_NAME=unito_signer
LIQUID_NETWORK=liquidtestnet
LWK_POLICY_ASSET=144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49
```

Local API keys and machine-only config should live under:

```text
config/local/
```

That folder is ignored by git.

## Current Limitations

- Primary sale is still a web/API mock path.
- The implemented covenant covers resale, not the full genesis sale contract.
- Demo data is in memory under `apps/web/data/`.
- LWK server, loaded wallet, and loaded signer must exist before real signing/broadcast.
- The sample PSET uses demo UTXOs unless real UTXOs are provided in the request body.

## Demo Flow

1. Open the market page.
2. Prepare a primary buy PSET for a new book token.
3. List an owned copy within the author-defined resale price caps.
4. Prepare a resale covenant PSET.
5. Check the returned summary:
   - seller payment
   - author royalty
   - buyer change
   - remaining license copies
   - optional Liquid fee
6. Sign and broadcast once LWK is configured.

## Development Notes

The canonical contract source is:

```text
contracts/license-resale/simplicity/license_resale.simf
```

The Rust crate embeds that file directly. If contract behavior changes, update the Simplicity source first, then update the UI/backend only to match the new covenant.
