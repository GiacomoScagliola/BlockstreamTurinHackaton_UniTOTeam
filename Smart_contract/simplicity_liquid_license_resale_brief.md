# Simplicity / Liquid Hackathon Project Brief

## Project Direction

We started from the idea of building a bond or collateralized debt system on Liquid/Simplicity, but after evaluating the economics, the stronger and more demo-friendly idea became a **recursive royalty covenant** applied to digital licenses, tickets, PDF books, software access, certifications, or event passes.

The final concept is:

> A creator/licensor issues a limited number of access tokens. Each token represents the right to access a digital asset or event. The creator can define a maximum resale price and optionally a royalty percentage. Whenever the token is resold, the Simplicity covenant enforces the price cap and automatically pays the royalty to the creator.

This is not just a marketplace rule. The rule follows the token through a recursive covenant.

---

# 1. Core Product Idea

## Name Ideas

- ReadRight
- LicenseLoop
- Covenanted Access Tokens
- Recursive License Covenant
- BookLoop
- AccessRight

## One-line Pitch

> A programmable license resale protocol on Liquid where limited digital access tokens carry their own resale rules, enforced by Simplicity covenants.

## Expanded Pitch

Creators can issue a fixed supply of access tokens for digital books, software, certifications, datasets, courses, or event tickets. Each token is locked in a Simplicity covenant that enforces:

1. Fixed supply.
2. Current ownership.
3. Maximum resale price.
4. Optional creator royalty.
5. Recursive resale rules.
6. Valid transfer only through the covenant.
7. Access granted only to the current token owner by the app/server.

The system lets digital content creators support a secondary market without losing control over resale policy or royalty collection.

---

# 2. Why Simplicity + Liquid

## Simplicity Strengths Used

The project uses Simplicity for:

- Recursive covenants.
- Transaction introspection.
- Asset-aware transfer validation.
- Signature verification.
- Timelock/redeem paths if needed.
- Static, auditable contract rules.
- Enforcing that the token remains locked under the same rules after each resale.

## Liquid Strengths Used

Liquid is useful because it supports:

- Issued assets.
- Fast settlement.
- Confidential transactions.
- Multi-asset payments.
- Tokenized access rights.
- Better UX for hackathon demos than Bitcoin L1.

Important distinction:

> Liquid is confidential, not fully private. UTXOs, txids, outputs, scripts and spent/unspent status can still be tracked. Amounts and asset types may be blinded unless the relevant blinding data is available.

---

# 3. Important Technical Limitation

For digital content such as PDFs, books, videos, or software binaries:

> A blockchain covenant cannot prevent a user from copying a file after they have accessed it.

So the system should not be marketed as:

> “Blockchain DRM that prevents all copying.”

Instead, the correct framing is:

> “A programmable license layer. The blockchain enforces ownership, resale constraints and royalty settlement. The app/server grants access only to the current token owner.”

For software, this resembles online license activation.

For PDFs, this resembles token-gated encrypted access.

For events, this resembles a ticketing system where the ticket carries resale rules.

---

# 4. Main Use Cases

## 4.1 PDF Book Resale

A publisher or author issues a limited number of PDF license tokens.

Each token represents the right to access the book through the platform.

The current owner can resell the token, but:

- The resale price cannot exceed the creator-defined cap.
- The author/publisher receives royalty automatically.
- The buyer receives the license token under the same covenant.
- The previous owner loses platform access after resale.

Example:

```text
Book: Mastering Simplicity
Supply: 100 licenses
Original price: 100 tUSD
Max resale price: 70 tUSD
Royalty: 10%
Author royalty: 7%
Publisher royalty: 3%
```

Valid resale:

```text
Bob sells to Carol for 60 tUSD

Author receives: 4.2 tUSD
Publisher receives: 1.8 tUSD
Bob receives: 54 tUSD
Carol receives: license token
```

Invalid resale:

```text
Bob tries to sell for 90 tUSD
Max resale price is 70 tUSD
Transaction rejected by covenant
```

## 4.2 Software License

A software company issues a fixed number of software license tokens.

The software app asks the server for activation. The server checks whether the requester currently owns a valid license token.

If the user resells the token, their future activation requests are denied.

Recommended model:

```text
license token + online activation + short-lived access certificate
```

Example activation certificate:

```json
{
  "license_id": "SOFTWARE_LICENSE_001",
  "owner": "BobPubKey",
  "expires_at": "2026-05-18T12:00:00Z",
  "features": ["pro"],
  "server_signature": "..."
}
```

## 4.3 Event Ticket

The token represents a ticket.

The creator/event organizer can set:

- Max resale price.
- Royalty.
- Fixed supply.
- Redeem path.

At event entry, the gate app verifies current token ownership and marks the ticket as redeemed.

This use case is easier than digital content because access is checked at a physical or live checkpoint.

## 4.4 Certifications

The token represents a certificate or credential.

Possible rules:

- Non-transferable certification.
- Transferable license with issuer royalty.
- Expiry date.
- Revocation/redeem path.
- Public verification that a given wallet owns a certification token.

---

# 5. Core Actors

## Creator / Author / Licensor

The entity that issues the token.

Responsibilities:

- Defines supply.
- Defines max resale price.
- Chooses whether royalties are enabled.
- Chooses royalty percentage.
- Receives royalty if enabled.
- Provides or authorizes access to the digital asset.

## Current Owner / Seller

The user who currently owns one license token.

Responsibilities:

- Can access the digital content.
- Can resell the token if the covenant rules are satisfied.
- Must sign resale transaction.

## Buyer

The user who receives the token after resale.

Responsibilities:

- Pays the resale price.
- Receives the token under the same covenant.
- Gains access after ownership verification.

## Server / App

The off-chain access layer.

Responsibilities:

- Tracks current license UTXO.
- Issues nonce challenges.
- Verifies wallet signatures.
- Checks token ownership.
- Serves digital content only to the current owner.
- Optionally streams encrypted content or issues software activation certificates.

---

# 6. Token Model

## Option A: One Asset With Fixed Supply N

The creator issues one Liquid asset with supply N.

Example:

```text
Asset: BOOK_LICENSE
Amount: 100
Each unit = one license
```

Pros:

- Simple.
- Good for books/software.
- Good for hackathon MVP.

Cons:

- Harder to track individual numbered licenses.
- Requires care to keep each unit in separate UTXOs.

Recommended approach if using this model:

```text
one license = one UTXO = amount 1
```

## Option B: One Asset Per License

The creator issues separate assets:

```text
BOOK_LICENSE_001
BOOK_LICENSE_002
BOOK_LICENSE_003
...
```

Pros:

- Each license is unique.
- Good for event tickets/certificates.
- Easy to redeem individual tokens.

Cons:

- More setup complexity.
- More issuance transactions.

## Recommendation for MVP

Use:

```text
one asset ID
fixed supply N
each license held as amount-1 UTXO
```

This keeps the demo simple while preserving individual ownership.

---

# 7. Fixed Supply

The creator chooses supply at issuance.

Example:

```text
max_supply = 10
```

The app recognizes only the original license asset ID.

If someone creates another asset later, it will have a different asset ID and will not be accepted by the app or covenant.

The covenant and app should commit to:

```text
LICENSE_ASSET_ID
CONTENT_ID_HASH
CREATOR_PUBKEY
MAX_SUPPLY
```

Practical MVP approach:

1. Creator issues exactly N license units.
2. App stores the official `LICENSE_ASSET_ID`.
3. Contract only accepts that asset ID.
4. Server only grants access to holders of that asset under the covenant.

---

# 8. Covenant Parameters

For the MVP, hardcode or commit to:

```text
LICENSE_ASSET_ID
PAYMENT_ASSET_ID
CREATOR_PUBKEY
CURRENT_OWNER_PUBKEY
MAX_RESALE_PRICE
ROYALTY_ENABLED
ROYALTY_BPS
CONTENT_ID_HASH
```

Example:

```text
Content: "Simplicity Developer Handbook"
Supply: 10
Payment asset: tUSD
Max resale price: 70 tUSD
Royalty enabled: true
Royalty: 10%
Creator: Alice
Current owner: Bob
```

On resale, the only covenant state that changes is:

```text
CURRENT_OWNER_PUBKEY = buyer_pubkey
```

Everything else remains fixed.

---

# 9. Main Smart Contract Behavior

The contract should have two core paths.

## 9.1 Resale Path

The current owner sells the token to a new buyer.

The contract checks:

1. Current owner signed the transaction.
2. Sale price is less than or equal to max resale price.
3. Buyer receives the license token.
4. The license token remains locked under the same covenant.
5. If royalties are enabled, creator receives the correct royalty.
6. Seller receives sale price minus royalty.
7. Payment is in the correct asset.
8. No invalid output can drain the token or bypass rules.

## 9.2 Redeem / Retire Path

Optional for digital content, more useful for events.

Possible uses:

- Ticket redeemed at event.
- License retired.
- Certificate revoked or consumed.
- Token sent to issuer/burn vault.

The contract checks:

1. Current owner signs.
2. Token goes to the issuer, burn address, or redeem vault.
3. Token exits active circulation.

---

# 10. Resale Transaction Structure

Recommended fixed-output layout for MVP:

```text
Input 0:
  license token UTXO under covenant, owned by seller

Input 1:
  buyer payment in tUSD

Output 0:
  license token under same covenant, new owner = buyer

Output 1:
  seller payment

Output 2:
  creator royalty

Output 3:
  change/fees
```

If royalties are disabled, output 2 can be omitted or set to zero depending on implementation simplicity.

---

# 11. Resale Contract Logic

Pseudocode, not real SimplicityHL syntax:

```rust
fn resale(w: Witness) -> bool {
    let price = w.sale_price;
    let buyer = w.buyer_pubkey;

    verify_signature(CURRENT_OWNER_PUBKEY, w.owner_signature);

    assert(price <= MAX_RESALE_PRICE);

    let royalty = if ROYALTY_ENABLED {
        price * ROYALTY_BPS / 10_000
    } else {
        0
    };

    let seller_amount = price - royalty;

    assert(output(0).asset == LICENSE_ASSET_ID);
    assert(output(0).amount == 1);
    assert(output(0).script == same_covenant_with_owner(buyer));

    assert(output(1).asset == PAYMENT_ASSET_ID);
    assert(output(1).amount == seller_amount);
    assert(output(1).recipient == CURRENT_OWNER_PUBKEY);

    if ROYALTY_ENABLED {
        assert(output(2).asset == PAYMENT_ASSET_ID);
        assert(output(2).amount == royalty);
        assert(output(2).recipient == CREATOR_PUBKEY);
    }

    return true;
}
```

---

# 12. Recursive Covenant Behavior

The “recursive” part does not mean the contract calls itself internally.

It means each valid spend must create a new UTXO with the same covenant logic.

```text
Bob owns license in covenant
        ↓ resale
Carol owns license in covenant
        ↓ resale
Dave owns license in covenant
        ↓ resale
...
```

The policy remains attached to the token:

```text
max price
royalty
creator
payment asset
content ID
```

The current owner changes.

This is the key differentiator.

---

# 13. Smart Contract Flow Diagram

```text
┌──────────────────────────────────────────┐
│ Spend UTXO containing license token       │
└──────────────────────┬───────────────────┘
                       │
                       v
┌──────────────────────────────────────────┐
│ Select action                             │
│ resale / redeem                           │
└──────────────┬───────────────┬───────────┘
               │               │
            resale          redeem
               │               │
               v               v
┌──────────────────────┐   ┌──────────────────────┐
│ Check owner signature │   │ Check owner signature │
└──────────┬───────────┘   └──────────┬───────────┘
           │                          │
           v                          v
┌──────────────────────┐   ┌──────────────────────┐
│ Check price <= max    │   │ Send token to redeem  │
│ resale price          │   │ vault / issuer / burn │
└──────────┬───────────┘   └──────────┬───────────┘
           │                          │
           v                          v
┌──────────────────────┐   ┌──────────────────────┐
│ Compute royalty       │   │ Accept redeem tx      │
└──────────┬───────────┘   └──────────────────────┘
           │
           v
┌──────────────────────┐
│ Verify buyer receives │
│ token under same      │
│ covenant              │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Verify creator royalty│
│ if enabled            │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Verify seller payout  │
└──────────┬───────────┘
           │
           v
┌──────────────────────┐
│ Accept transaction    │
└──────────────────────┘
```

---

# 14. Contract Invariants

These are important for the README/pitch.

## Invariant 1

The license token cannot leave the covenant except through an allowed redeem/retire path.

## Invariant 2

Every resale must respect the maximum resale price.

```text
sale_price <= max_resale_price
```

## Invariant 3

If royalties are enabled, every resale must pay the creator.

```text
royalty = sale_price * royalty_bps / 10_000
```

## Invariant 4

The buyer only receives the license token if the seller and creator receive correct payments.

## Invariant 5

The seller only receives payment if the buyer receives the license token under the same covenant.

## Invariant 6

The license token remains recursively bound to the same resale rules.

## Invariant 7

The app grants access only to the current owner of an active license token.

---

# 15. Access Control Problem

The key question was:

> How can only the owner of a token utilize the digital asset, for example software or a PDF, on a public/confidential chain like Liquid?

Answer:

> Use a hybrid design. Simplicity enforces ownership and resale rules. The server grants access only after the user proves current ownership by signing a nonce with the current owner key.

The blockchain does not serve the file. The server or app does.

---

# 16. Server Ownership Verification

## Core Pattern

Use challenge-response authentication.

The private key must never be sent to the server.

Correct pattern:

```text
wallet signs nonce → server verifies signature → server checks signer is current token owner → server grants access
```

Wrong pattern:

```text
user submits private key to server
```

Never ask for the private key.

---

# 17. Access Verification Flow

```text
User wants access
      ↓
Server checks current license state:
  license_id → current_owner_pubkey
      ↓
Server creates nonce:
  "Access request for Book #1, nonce 0xabc..."
      ↓
User signs nonce with wallet
      ↓
Server verifies:
  signature is valid for current_owner_pubkey
      ↓
Server checks:
  license UTXO is still unspent / active
      ↓
Access granted
```

Diagram:

```text
┌─────────────────────────────┐
│ User clicks “Access content” │
└──────────────┬──────────────┘
               │
               v
┌─────────────────────────────┐
│ Server creates nonce         │
└──────────────┬──────────────┘
               │
               v
┌─────────────────────────────┐
│ User signs nonce             │
│ with wallet/private key      │
└──────────────┬──────────────┘
               │
               v
┌─────────────────────────────┐
│ Server verifies signature    │
└──────────────┬──────────────┘
               │
               v
┌─────────────────────────────┐
│ Server checks current UTXO   │
│ Does this key own license?   │
└──────────────┬──────────────┘
               │
      ┌────────┴────────┐
      │                 │
      v                 v
┌─────────────┐   ┌──────────────┐
│ Grant access│   │ Deny access   │
└─────────────┘   └──────────────┘
```

---

# 18. What the Server Checks

For each access request, the server checks:

```text
1. The nonce exists.
2. The nonce is fresh.
3. The nonce has not been used before.
4. The nonce is bound to the requested content.
5. The user signature is valid.
6. The signer public key matches the current owner public key.
7. The current license UTXO is unspent.
8. The license status is active, not redeemed or retired.
```

---

# 19. Example Backend State

For a hackathon MVP, the server can keep local state:

```json
{
  "book-001": {
    "licenseAssetId": "abc123",
    "currentOwnerPubkey": "BobPubKey",
    "currentUtxo": "txid:vout",
    "status": "ACTIVE",
    "pdfPath": "./content/book.pdf"
  }
}
```

After Bob resells to Carol:

```json
{
  "book-001": {
    "licenseAssetId": "abc123",
    "currentOwnerPubkey": "CarolPubKey",
    "currentUtxo": "new_txid:0",
    "status": "ACTIVE",
    "pdfPath": "./content/book.pdf"
  }
}
```

Bob is now denied access. Carol is granted access.

---

# 20. Example API

## POST `/auth/challenge`

Request:

```json
{
  "contentId": "book-001",
  "claimedPubkey": "BobPubKey"
}
```

Response:

```json
{
  "nonce": "9f4a2c1e...",
  "message": "ReadRight Access Request\nDomain: readright.demo\nContent ID: book-001\nNonce: 9f4a2c1e...\nExpires At: 2026-05-17T15:05:00Z"
}
```

## POST `/auth/verify`

Request:

```json
{
  "contentId": "book-001",
  "pubkey": "BobPubKey",
  "signature": "..."
}
```

Server verifies signature and ownership.

Successful response:

```json
{
  "success": true,
  "accessToken": "short-lived-server-token",
  "expiresIn": 300
}
```

Failure response:

```json
{
  "success": false,
  "error": "Signer is not the current license owner"
}
```

## GET `/content/:contentId`

Requires:

```text
Authorization: Bearer <accessToken>
```

If valid, the server streams the digital content.

---

# 21. Nonce Message Design

The message should include:

```text
domain
content ID
license ID
license asset ID
nonce
issued at
expires at
```

Example:

```text
ReadRight Access Request

Domain: readright.demo
Content ID: book-001
License ID: license-01
License Asset: abc123...
Nonce: 8f24a9...
Issued At: 2026-05-17T15:00:00Z
Expires At: 2026-05-17T15:05:00Z
```

Security requirements:

```text
nonce must be random
nonce must be single-use
nonce must expire quickly
nonce must be bound to the content and domain
```

---

# 22. Minimal Backend Verification Pseudocode

```typescript
async function verifyAccess(contentId, pubkey, signature, nonce) {
  const challenge = await db.getChallenge(nonce);

  if (!challenge) return deny("Unknown nonce");
  if (challenge.used) return deny("Nonce already used");
  if (challenge.expiresAt < Date.now()) return deny("Nonce expired");
  if (challenge.contentId !== contentId) return deny("Wrong content");

  const license = await db.getLicenseForContent(contentId);

  if (license.status !== "ACTIVE") {
    return deny("License not active");
  }

  if (license.currentOwnerPubkey !== pubkey) {
    return deny("Signer is not current owner");
  }

  const validSig = verifySignature(challenge.message, signature, pubkey);

  if (!validSig) {
    return deny("Invalid signature");
  }

  const unspent = await liquidNode.isUnspent(license.currentUtxo);

  if (!unspent) {
    return deny("License UTXO already spent");
  }

  await db.markChallengeUsed(nonce);

  return grantAccess({
    contentId,
    ownerPubkey: pubkey,
    expiresIn: 300
  });
}
```

---

# 23. Serving Digital Content

Do not expose static public URLs such as:

```text
/public/book.pdf
```

Instead, serve through an authenticated route:

```text
GET /content/book-001
Authorization: Bearer <accessToken>
```

For PDFs:

- Store encrypted file.
- Server releases temporary decryption key or streams the file only after ownership proof.

For software:

- Server issues short-lived activation certificate.
- Software runs only while certificate is valid.
- On renewal, software must prove current ownership again.

---

# 24. Liquid Confidentiality and Server Visibility

Liquid is confidential, not opaque.

The server can generally see:

```text
txid
vout index
transaction graph
spent/unspent status
scripts/locking conditions
```

What may be hidden:

```text
asset type
amount
```

Therefore the server has three implementation options.

## Option A: Server Tracks Lineage From Issuance

Best for hackathon.

The server creates the license and follows each transfer performed through the app.

It stores:

```text
license ID
current txid:vout
current owner pubkey
status
```

It does not need to scan the entire chain.

## Option B: User Provides UTXO + Unblinding Data

If transfer happens outside the app, the new owner can submit:

```text
txid:vout
owner pubkey
blinding data or wallet proof
```

The server verifies that the UTXO contains the valid license asset and is unspent.

## Option C: Make License Outputs Partially Explicit

For a compliance/demo product, keep license identity and owner decodable while keeping payment amounts confidential.

Good compromise:

```text
license ownership = server-trackable
payment amounts = confidential
```

---

# 25. If Transfers Happen Outside the App

If the covenant is designed correctly, the token cannot escape the resale rules.

Even if users build their own transaction, the new output must still satisfy:

```text
same covenant template
new owner pubkey
royalty payment
max price respected
```

But the server may not know the new owner automatically.

Solution:

```text
1. Buyer submits txid:vout to server.
2. Server verifies that it is an unspent covenant output.
3. Buyer signs nonce with owner key.
4. Server updates ownership and grants access.
```

If outputs are confidential, buyer may also need to provide unblinding data.

---

# 26. App Architecture

Recommended architecture:

```text
Frontend
  ↓
Backend / access server
  ↓
Transaction builder
  ↓
Liquid regtest/testnet
  ↓
SimplicityHL covenant
```

## Frontend

Shows:

```text
content title
creator
current owner
max resale price
royalty percentage
supply
access status
resale button
open content button
transaction log
```

## Backend

Handles:

```text
nonce generation
signature verification
ownership state
access tokens
PDF/software access
transaction creation
UTXO state updates
```

## Transaction Builder

Builds:

```text
issue license
valid resale
invalid resale
redeem/retire
```

## Simplicity Contract

Enforces:

```text
current owner signature
max resale price
royalty payment
same covenant output
correct asset transfer
```

---

# 27. Final App Flow

```text
┌─────────────────────────────┐
│ User opens app               │
└──────────────┬──────────────┘
               │
               v
┌─────────────────────────────┐
│ Load license state           │
│ owner, price cap, royalty    │
└──────────────┬──────────────┘
               │
               v
┌─────────────────────────────┐
│ Display content card         │
│ Open / Resell / History      │
└───────┬─────────────┬───────┘
        │             │
        v             v
┌──────────────┐  ┌────────────────┐
│ Access flow   │  │ Resale flow    │
└──────┬───────┘  └────────┬───────┘
       │                   │
       v                   v
┌──────────────┐  ┌────────────────────────┐
│ Nonce auth    │  │ Build resale tx         │
└──────┬───────┘  └────────┬───────────────┘
       │                   │
       v                   v
┌──────────────┐  ┌────────────────────────┐
│ Verify owner  │  │ Submit to Liquid        │
└──────┬───────┘  └────────┬───────────────┘
       │                   │
       v                   v
┌──────────────┐  ┌────────────────────────┐
│ Grant/deny    │  │ Covenant validates      │
│ content       │  └──────┬──────────┬─────┘
└──────────────┘         │          │
                         v          v
              ┌──────────────┐ ┌──────────────┐
              │ Accepted      │ │ Rejected      │
              └──────┬───────┘ └──────┬───────┘
                     │                │
                     v                v
              ┌──────────────┐ ┌──────────────┐
              │ Update owner  │ │ Show error    │
              │ and royalty   │ │ price too high│
              └──────────────┘ └──────────────┘
```

---

# 28. Demo Sequence

Recommended demo:

```text
1. Creator Alice issues 10 access tokens for "Simplicity Developer Handbook".
2. Bob owns one token.
3. Bob clicks "Open content".
4. Server sends nonce.
5. Bob signs.
6. Server verifies Bob is current owner.
7. Content opens.

8. Carol tries to open the content.
9. Carol signs.
10. Server sees current owner is Bob.
11. Access denied.

12. Bob tries to resell for 90 tUSD.
13. Max resale price is 70 tUSD.
14. Covenant rejects transaction.

15. Bob resells to Carol for 60 tUSD.
16. Covenant accepts transaction.
17. Alice receives 6 tUSD royalty.
18. Bob receives 54 tUSD.
19. Carol receives token under same covenant.

20. Bob tries to open content again.
21. Access denied.

22. Carol opens content.
23. Access granted.
```

This proves:

```text
fixed supply
ownership-gated access
max resale price
royalty
recursive covenant transfer
server-side access control
```

---

# 29. 12-Hour MVP Scope

Build only:

```text
one content item
one license asset
fixed supply
one creator
one seller
one buyer
fixed royalty
fixed max price
valid resale path
invalid resale path
access check by nonce signature
simple UI
```

Do not build:

```text
real DRM
full marketplace
multiple books
browser wallet integration if too slow
auctions
real user accounts
KYC
complex indexer
dynamic royalty settings
multi-creator splits
```

---

# 30. Suggested Team Split for 7 People

## 1. Smart Contract Lead

Owns SimplicityHL covenant.

Implements:

```text
resale path
optional redeem path
price cap check
royalty check
same covenant output check
```

## 2. Transaction Builder / Liquid Integration

Builds transactions:

```text
issue
valid resale
invalid resale
redeem/retire
```

Works with Liquid regtest/testnet.

## 3. Contract Tester

Tests valid and invalid paths:

```text
valid resale passes
price too high fails
missing royalty fails
wrong buyer output fails
wrong asset fails
```

## 4. Backend / Auth Engineer

Builds:

```text
POST /auth/challenge
POST /auth/verify
GET /content/:id
POST /resell-valid
POST /resell-invalid
GET /state
```

Implements nonce signature verification and local state.

## 5. Frontend Engineer

Builds simple web UI:

```text
content card
current owner
open content button
valid resale button
invalid resale button
transaction log
```

## 6. Demo / Pitch / Docs

Prepares:

```text
README
state diagrams
pitch
limitations
demo script
screenshots
Devpost copy
```

## 7. Floating Integrator

Connects pieces:

```text
env setup
local state
API wiring
bug fixes
demo fallback
video/screenshots
```

---

# 31. 12-Hour Workflow

## Hour 0–1: Scope Freeze

Decide:

```text
content name
supply
asset IDs
max price
royalty
demo users
contract paths
API endpoints
UI wireframe
```

No new features after this.

## Hour 1–3: Skeletons

Parallel work:

```text
contract skeleton
transaction builder skeleton
backend mocked endpoints
frontend static UI
README/state diagram
```

## Hour 3–6: First End-to-End Mock Demo

Goal:

```text
UI can show:
Bob has access
Carol denied
invalid resale rejected
valid resale accepted
Carol gets access
```

Even if some parts are mocked, demo shape exists.

## Hour 6–9: Real Contract Integration

Priorities:

```text
valid resale accepted on Liquid/regtest
invalid resale rejected by covenant
backend updates owner
access checks use owner state
```

## Hour 9–10.5: Hardening

Freeze features.

Test only the demo path.

Prepare fallback:

```text
screenshots
logs
txids
short video
```

## Hour 10.5–12: Polish

Finish:

```text
UI copy
pitch
README
demo script
limitations
```

---

# 32. Key Phrases for Judges

Use these:

> “We are not building DRM. We are building a programmable license layer.”

> “Simplicity enforces ownership transfer, price caps and royalties. The server enforces access based on current token ownership.”

> “The token cannot escape the covenant. Every resale recreates the same covenant with a new owner.”

> “The private key never leaves the wallet. The server only asks the wallet to sign a fresh nonce.”

> “Liquid is confidential, not opaque. We track the license UTXO lineage while keeping payments confidential.”

> “This enables publisher-authorized resale of digital licenses while preserving creator royalties.”

---

# 33. Final Technical Summary

The system consists of three parts:

## 1. Liquid Issued Asset

Represents the license/access right.

```text
LICENSE_ASSET_ID
fixed supply N
one token = one license
```

## 2. Simplicity Covenant

Enforces market rules.

```text
only owner can resell
price <= max price
royalty paid to creator
buyer receives token
token remains under same covenant
```

## 3. Access Server

Enforces content access.

```text
server issues nonce
wallet signs nonce
server verifies signature
server checks current owner pubkey
server checks UTXO is active
server grants or denies access
```

Combined:

```text
Simplicity = ownership and resale policy
Liquid asset = scarce license
Server = content access control
Wallet signature = proof of current ownership
```

---

# 34. Final One-Minute Pitch

> We built a programmable license resale system using Simplicity on Liquid. A creator can issue a fixed number of access tokens for digital content, software, certifications or event tickets. Each token is locked in a recursive covenant that enforces a maximum resale price and optional creator royalty. Whenever a token is resold, the buyer receives the token under the same covenant, the seller receives the net payment, and the creator automatically receives the royalty. For digital content access, the app uses wallet-based nonce authentication: the server grants access only if the user proves control of the current owner key for an active license-token UTXO. This lets creators support authorized secondary markets without giving up resale rules or royalties.
