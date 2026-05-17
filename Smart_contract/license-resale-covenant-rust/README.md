# License Resale Simplicity Covenant

This is the first MVP contract for the hackathon app described in `simplicity_liquid_license_resale_brief.md`.

It implements a recursive Liquid covenant for explicit, non-confidential resale transactions:

- current seller signs the resale transaction
- sale price must be between `MIN_RESALE_PRICE` and `MAX_RESALE_PRICE`
- input 0 must contain the official `LICENSE_ASSET_ID`
- input 1 must contain the official `PAYMENT_ASSET_ID`
- buyer receives sold license copies under the same covenant with owner state changed to the buyer pubkey
- unsold license copies return to the same covenant with owner state unchanged
- seller receives `sale_price - royalty`
- creator receives `sale_price * ROYALTY_BPS / 10000`
- buyer receives `payment_input - sale_price - fee_amount` as payment change when a fee output is present

## Parameters

These are compile-time/contract-instance parameters chosen by the author at genesis:

```text
LICENSE_ASSET_ID
PAYMENT_ASSET_ID
CREATOR_PUBKEY
MIN_RESALE_PRICE
MAX_RESALE_PRICE
ROYALTY_BPS
```

Set `ROYALTY_BPS = 0` to disable royalties. In that case output 3 is still present in this strict MVP layout with amount `0`.
See `license_resale.args.example.json` for the `.args` shape expected by `simc`.

## Genesis Instance

The genesis contract is the same program locked with owner state equal to the author's pubkey:

```text
owner_state = AUTHOR_PUBKEY
CREATOR_PUBKEY = AUTHOR_PUBKEY
```

The initial UTXO should contain the fixed supply of the license asset. The app should also store the official license asset id, content id hash, and contract parameters.

## Resale Transaction Layout

```text
Input 0: license covenant UTXO owned by seller
Input 1: buyer payment UTXO

Output 0: sold license copies -> covenant(owner = buyer)
Output 1: remaining license copies -> covenant(owner = seller)
Output 2: seller payment -> direct P2TR seller key
Output 3: royalty payment -> direct P2TR creator key
Output 4: buyer change -> direct P2TR buyer key
Output 5: optional fee output
```

All assets and amounts are required to be explicit. Confidential assets or confidential values fail because the contract unwraps the explicit branch of `input_amount` and `output_amount`.

When using the strict 2-input layout, the fee can only be paid from input 1. In practice that means `PAYMENT_ASSET_ID` must be the network policy asset if `HAS_FEE_OUTPUT = true`.

## Notes

The contract uses the same Taproot state-commitment pattern as the workshop `third-time` example and the reference `simplicity-contracts` storage examples: the owner pubkey is committed as TapData next to the current Simplicity leaf, and each resale requires output 0 to commit to the buyer as the next owner.

This is not a full transaction builder yet. The next implementation step is a builder that:

1. computes the state-committed covenant address for the author/seller and buyer,
2. creates explicit-amount Liquid outputs in the exact indexes above,
3. computes the Simplicity sighash,
4. obtains the seller signature,
5. recompiles/injects the witness,
6. finalizes and broadcasts the PSET.

## Rust / LWK Implementation

The Rust crate in this directory implements those builder steps with `smplx-std` and LWK-compatible Elements types.

Main API:

```rust
use license_resale_covenant::{
    LicenseResaleContract, LicenseResaleParameters, ResaleTerms,
};

let contract = LicenseResaleContract::new(LicenseResaleParameters {
    license_asset_id,
    payment_asset_id,
    creator_pubkey,
    min_resale_price,
    max_resale_price,
    royalty_bps,
});

let unsigned = contract.build_unsigned_resale(
    license_utxo,
    buyer_payment_utxo,
    seller_pubkey,
    buyer_pubkey,
    ResaleTerms {
        sale_price,
        sold_license_copies: 1,
        fee_amount,
    },
    &network,
)?;
```

Then finalize the covenant input and sign the buyer payment input:

```rust
let mut pst = unsigned.pst;

contract.sign_and_finalize_resale_input(
    &mut pst,
    &seller_signer,
    seller_pubkey,
    buyer_pubkey,
    terms,
    &network,
)?;

LicenseResaleContract::sign_buyer_payment_input(&mut pst, &buyer_signer)?;
```

After that, the app can extract and broadcast the transaction through the configured LWK provider/client for the target environment.

Run local checks:

```bash
cargo test
```

Current tests cover:

- valid resale PSET layout and amount split
- rejection of resale price above cap
- successful Simplicity finalization for a valid witness
- covenant rejection when the royalty output is underpaid
