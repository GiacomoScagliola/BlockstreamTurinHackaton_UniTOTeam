# Project Brief: Recursive License Covenants on Liquid

## Overview

LicenseLoop (also known as ReadRight) is a programmable license protocol built on the Liquid Network using Simplicity. It allows creators to issue digital access tokens (representing books, software, event tickets, etc.) that carry their own resale rules, enforced directly by the blockchain.

### Core Value Proposition

Unlike traditional digital marketplaces where resale rules are mere database entries, LicenseLoop uses **recursive covenants**. This means the rules—such as price caps and author royalties—are embedded in the token itself and follow it through every secondary sale.

---

## Use Cases

### 1. Digital Book Resale
A publisher issues a limited number of license tokens for a digital book. The covenant enforces:
- **Maximum Resale Price**: Prevents scalping and maintains market stability.
- **Creator Royalties**: Automatically distributes a percentage of every resale back to the author.
- **Ownership Proof**: Only the current holder of the token can access the digital content.

### 2. Software Licensing
Software licenses issued as tokens can be easily transferred or resold. The software application verifies ownership by challenging the user's wallet to sign a nonce, ensuring only one active user per license.

### 3. Event Ticketing
Event organizers can set hard caps on resale prices to eliminate predatory secondary markets. Tokens can also include a "redeem" path that retires the token once the attendee enters the venue.

---

## Technical Architecture

The system utilizes a hybrid design to balance blockchain enforcement with off-chain access:

1.  **Simplicity Covenant**: Enforces ownership transfer rules, price constraints, and royalty payments at the consensus layer.
2.  **Liquid Network**: Provides the infrastructure for asset issuance, fast settlement, and multi-asset transactions.
3.  **Access Server**: A traditional backend that serves the digital content only after verifying that the requester owns a valid, unspent license UTXO by using a challenge-response signature flow.

### Access Verification Flow

1.  **User Request**: User clicks "Access Content" in the app.
2.  **Challenge**: The server generates a random, short-lived nonce.
3.  **Signature**: The user's wallet signs the nonce with the private key corresponding to the license owner.
4.  **Verification**: The server verifies the signature, checks the Liquid blockchain to ensure the license UTXO is still unspent, and confirms the signer is the current owner.
5.  **Access**: Content is streamed or a temporary access token is issued.

---

## Project Roadmap

- [x] **Simplicity Covenant**: Recursive resale logic with price caps and royalties.
- [x] **Transaction Builder**: Rust-based CLI and library to prepare and finalize PSETs.
- [x] **Marketplace UI**: Web-based demo for buying, listing, and reselling licenses.
- [x] **LWK Integration**: Support for Liquid Wallet Kit for signing and broadcasting.
- [ ] **Dynamic Ownership Verification**: (Planned) Challenge-response flow for gated content access.

## Strategic Vision

LicenseLoop is not intended as a DRM (Digital Rights Management) system that prevents all file copying. Instead, it is a **programmable license layer** that provides a standardized, trustless way for creators to monetize secondary markets and for users to truly own and trade their digital rights.
