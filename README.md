# Liquid License Market (LicenseLoop)

A hackathon prototype for a Liquid digital-license marketplace backed by a Simplicity recursive resale covenant.

The app lets creators issue and sell digital license tokens for **books, software, event tickets, or certifications**. It enforces secondary-market rules directly on the blockchain, allowing owners to list copies for resale while automatically distributing royalties to the original author. The contract is the source of truth: the UI and backend are built to respect and prepare transactions according to the covenant rules.

## What Is Implemented

- **Express Web Demo**: A marketplace interface with market, wallet, asset details, and buy/sell flows.
- **Primary Sale Mock**: A simulated flow for the initial issuance and purchase of license tokens.
- **Secondary Sale Protocol**: A resale flow backed by a Rust-based Simplicity covenant builder.
- **LWK Integration**: Integration points for Liquid Wallet Kit (LWK) to manage wallet status, signing, PSET creation, and broadcasting.
- **Simplicity Covenant**: A recursive covenant for non-confidential Liquid resale transactions, enforcing price caps and royalties.
- **Rust Builder**: A specialized crate that constructs valid 2-input resale PSETs and finalizes the Simplicity witness.

## Repository Layout

```text
BlockstreamTurinHackaton_UniTOTeam/
|-- apps/
|   `-- web/                         Express + Handlebars marketplace demo
|       |-- routes/                   HTTP routes (books, listings, wallet, tx, liquid-api)
|       |-- services/                 LWK, Liquid API, and Simplicity builder services
|       |-- domain/                   Domain logic (royalty splitting, price validation)
|       |-- views/                    Handlebars UI templates
|       |-- public/                   Client-side JS and CSS
|       `-- data/                     Mock marketplace and NFT data
|
|-- contracts/
|   `-- license-resale/
|       |-- simplicity/               Canonical SimplicityHL source and examples
|       |-- rust-builder/             Rust PSET builder and covenant finalizer
|       `-- README.md                 Detailed contract specifications
|
|-- docs/
|   `-- project_brief_and_use_cases.md   Product vision and detailed use cases
|
|-- config/
|   `-- local/                        Ignored local environment and machine config
|
|-- .gitignore
`-- README.md
```

## Contract Rules

The resale covenant currently enforces this transaction shape:

```text
Input 0: seller's license covenant UTXO
Input 1: buyer payment UTXO

Output 0: sold license copies locked to covenant (owner = buyer)
Output 1: remaining license copies locked to covenant (owner = seller)
Output 2: seller payment
Output 3: author royalty
Output 4: buyer payment change
Output 5: optional Liquid fee output
```

Important rules:

- **Explicit Values**: Assets and amounts must be explicit (not confidential) for contract validation.
- **Policy Parameters**: `LICENSE_ASSET_ID`, `PAYMENT_ASSET_ID`, `CREATOR_PUBKEY`, `MIN_RESALE_PRICE`, `MAX_RESALE_PRICE`, and `ROYALTY_BPS` are fixed at genesis.
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

## LWK Setup:

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

## Future Roadmap & Limitations

This project is a functional prototype focused on the core Simplicity covenant logic. The following features are currently out of scope or planned for future development:

- **Server-Side Ownership Verification**: The logic for server-level authorization of asset utilization (e.g., gated access to a PDF or software binary) is described in the `docs/` but not implemented. In a production environment, the server would issue a random nonce that the user must sign with their wallet to prove control over the current license UTXO.
- **Automated Primary Sales**: The primary sale flow (initial minting/selling) is currently a web API mock. A full implementation would involve a dedicated "Genesis Covenant" to manage initial issuance and stock.
- **Real-Time Indexer**: The app uses mock data and manually provided UTXOs. A production version would require a robust blockchain indexer (like Esplora or Electrum) to track license lineage automatically.
- **Confidential Assets**: The current covenant requires explicit assets and values for validation. Future iterations could leverage Simplicity's ability to handle confidential transactions once the relevant jets are fully integrated.
- **Wallet Integration**: Real signing and broadcasting require a local LWK server and pre-configured wallet/signer.

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
