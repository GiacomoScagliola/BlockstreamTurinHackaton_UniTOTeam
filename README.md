# BlockstreamTurinHackaton_UniTOTeam

# Liquid Book Marketplace con Simplicity

## Obiettivo del progetto

Creare un marketplace di libri digitali su Liquid in cui ogni libro/copia è rappresentato da un asset/token e vincolato da smart contract Simplicity.

Il sistema deve permettere:

- vendita primaria dal sito/autore al primo acquirente;
- creazione di una copia del libro sotto forma di smart contract vincolato;
- rivendita della copia tra utenti;
- royalty automatica all'autore sulle rivendite;
- fee automatica al creatore/sito;
- prezzo di rivendita limitato a un intervallo compreso tra -20% e +20% rispetto all'ultimo prezzo di vendita;
- propagazione delle regole nel tempo: ogni nuovo acquirente riceve una nuova copia vincolata dallo stesso smart contract.

---

## Concetto fondamentale

In Simplicity/Liquid non si lavora come in Solidity con variabili globali modificabili.

Non esiste una cosa tipo:

```solidity
books[id].stock -= 1;
```

Il modello è UTXO-based.

Quindi lo stato viene rappresentato dagli UTXO, e ogni transazione:

1. consuma uno stato vecchio;
2. crea uno stato nuovo;
3. il contratto controlla che il nuovo stato sia valido.

Nel nostro caso:

```text
UTXO vecchio del contratto
    ↓
transazione controllata da Simplicity
    ↓
UTXO nuovo del contratto aggiornato
```

Questo pattern è un covenant: il contratto impone che gli output della transazione rispettino certe condizioni.

---

# Architettura dei contratti

Servono due tipi principali di contratto:

```text
BookSaleContract
    contratto iniziale del libro
    gestisce vendita primaria e stock iniziale

BookCopyContract
    contratto della singola copia venduta
    gestisce rivendite future
```

---

## 1. BookSaleContract

È il contratto usato per vendere nuove copie dal sito/autore.

Contiene:

```text
book_asset_id
payment_asset_id
initial_price
author_script_hash
site_script_hash
copies_remaining
```

Quando un utente compra una nuova copia:

```text
input:
  - BookSaleContract con N copie
  - pagamento del buyer

output:
  0: BookSaleContract con N - 1 copie
  1: BookCopyContract per il buyer
  2: pagamento autore = 90%
  3: pagamento sito = 10%
  4: eventuale resto buyer
```

Nella vendita primaria:

```text
venditore = autore
autore riceve 90%
sito riceve 10%
buyer riceve una copia vincolata dal BookCopyContract
```

Pseudo-logica:

```rust
fn primary_sale() {
    let price = INITIAL_PRICE;

    let buyer_pubkey = witness::BUYER_PUBKEY;
    let buyer_script_hash = witness::BUYER_SCRIPT_HASH;

    assert!(copies_remaining > 0);

    assert_output_pays(2, AUTHOR_SCRIPT_HASH, price * 90 / 100);
    assert_output_pays(3, SITE_SCRIPT_HASH, price * 10 / 100);

    assert_output_is_book_sale_contract(
        0,
        copies_remaining - 1
    );

    assert_output_is_book_copy_contract(
        1,
        book_asset_id,
        payment_asset_id,
        owner_pubkey = buyer_pubkey,
        owner_script_hash = buyer_script_hash,
        author_script_hash = AUTHOR_SCRIPT_HASH,
        site_script_hash = SITE_SCRIPT_HASH,
        last_sale_price = price
    );
}
```

---

## 2. BookCopyContract

È il contratto che rappresenta una singola copia già comprata.

Contiene:

```text
book_asset_id
payment_asset_id
current_owner_pubkey
current_owner_script_hash
author_script_hash
site_script_hash
last_sale_price
```

Quando il proprietario rivende la copia:

```text
input:
  - BookCopyContract del vecchio owner
  - pagamento del nuovo buyer

output:
  0: nuovo BookCopyContract per il nuovo buyer
  1: pagamento vecchio owner
  2: royalty autore
  3: fee sito
  4: eventuale resto buyer
```

Il venditore non è più l'autore, ma il proprietario corrente:

```text
seller = current_owner
```

Il contratto deve controllare:

```text
- il proprietario corrente firma la vendita;
- il prezzo di rivendita è compreso tra -20% e +20%;
- il vecchio owner riceve la sua quota;
- l'autore riceve la royalty;
- il sito riceve la fee;
- il nuovo buyer riceve un nuovo BookCopyContract;
- il nuovo BookCopyContract mantiene le stesse regole.
```

Pseudo-logica:

```rust
fn resale() {
    let old_owner_pubkey = param::CURRENT_OWNER_PUBKEY;
    let old_owner_script_hash = param::CURRENT_OWNER_SCRIPT_HASH;

    let author_script_hash = param::AUTHOR_SCRIPT_HASH;
    let site_script_hash = param::SITE_SCRIPT_HASH;

    let last_sale_price = param::LAST_SALE_PRICE;

    let new_owner_pubkey = witness::NEW_OWNER_PUBKEY;
    let new_owner_script_hash = witness::NEW_OWNER_SCRIPT_HASH;
    let new_sale_price = witness::NEW_SALE_PRICE;

    assert_signature(old_owner_pubkey);

    let min_price = last_sale_price * 80 / 100;
    let max_price = last_sale_price * 120 / 100;

    assert!(new_sale_price >= min_price);
    assert!(new_sale_price <= max_price);

    let seller_amount = new_sale_price * 80 / 100;
    let author_amount = new_sale_price * 15 / 100;
    let site_amount = new_sale_price - seller_amount - author_amount;

    assert_output_pays(
        1,
        old_owner_script_hash,
        seller_amount
    );

    assert_output_pays(
        2,
        author_script_hash,
        author_amount
    );

    assert_output_pays(
        3,
        site_script_hash,
        site_amount
    );

    assert_output_is_book_copy_contract(
        0,
        book_asset_id,
        payment_asset_id,
        current_owner_pubkey = new_owner_pubkey,
        current_owner_script_hash = new_owner_script_hash,
        author_script_hash = author_script_hash,
        site_script_hash = site_script_hash,
        last_sale_price = new_sale_price
    );
}
```

---

# Differenza tra vendita primaria e rivendita

## Vendita primaria

```text
BookSaleContract
    seller = author
    copies = N

buyer paga initial_price

output:
    BookSaleContract con copies = N - 1
    BookCopyContract con owner = buyer
    autore 90%
    sito 10%
```

## Rivendita

```text
BookCopyContract
    owner = seller
    last_sale_price = old_price

new_buyer paga new_price

controlli:
    seller firma
    new_price tra old_price * 80% e old_price * 120%

output:
    nuovo BookCopyContract con owner = new_buyer
    seller riceve X%
    autore riceve royalty
    sito riceve fee
```

---

# Esempio concreto

## Prima vendita

```text
prezzo iniziale = 100_000 sats

autore riceve = 90_000 sats
sito riceve = 10_000 sats

Alice riceve:
BookCopyContract {
    owner = Alice
    last_sale_price = 100_000
    author = Author
    site = Site
}
```

## Rivendita

Alice vuole rivendere a Bob per 110_000 sats.

Il contratto controlla:

```text
prezzo minimo = 100_000 * 80% = 80_000
prezzo massimo = 100_000 * 120% = 120_000
```

110_000 è valido.

Output:

```text
BookCopyContract {
    owner = Bob
    last_sale_price = 110_000
    author = Author
    site = Site
}
```

Pagamento, esempio con 80/15/5:

```text
Alice = 88_000 sats
autore = 16_500 sats
sito = 5_500 sats
```

---

# Percentuali consigliate

## Vendita primaria

```text
90% autore
10% sito
```

## Rivendita

Possibile split:

```text
80% venditore
15% autore
5% sito
```

Oppure:

```text
85% venditore
10% autore
5% sito
```

Per evitare problemi di arrotondamento:

```ts
seller_amount = (price * 80n) / 100n;
author_amount = (price * 15n) / 100n;
site_amount = price - seller_amount - author_amount;
```

---

# Ruolo del sito e del backend

Il sito non deve costruire direttamente tutta la logica Liquid/Simplicity.

Il sito dovrebbe chiamare un backend/transaction builder.

Architettura:

```text
Frontend sito
    |
    | click "Compra" / "Rivendi"
    v
Backend API
    |
    | prepara transazione Liquid
    v
Wallet / signer
    |
    | firma input buyer / seller
    v
Liquid node / explorer API
    |
    | broadcast
    v
Liquid Network
```

Il backend non è la fonte di verità finale.

Il backend prepara la transazione, ma il contratto Simplicity la accetta solo se gli output rispettano le regole.

---

# Workflow: click del sito → transazione Liquid

## Acquisto primario

```text
1. Utente clicca "Compra"
2. Frontend manda al backend:
   - book_id
   - buyer_address / buyer_script_pubkey
   - payment_asset
   - eventuali UTXO del buyer

3. Backend cerca nel database:
   - asset_id del libro
   - prezzo iniziale
   - autore
   - indirizzo sito
   - UTXO del BookSaleContract

4. Backend costruisce una transazione Liquid:
   input:
     - UTXO del BookSaleContract con N copie
     - UTXO pagamento del buyer

   output:
     - nuovo BookSaleContract con N - 1 copie
     - BookCopyContract per il buyer
     - pagamento autore 90%
     - pagamento sito 10%
     - resto buyer

5. Backend restituisce al frontend una PSET da firmare

6. Wallet firma

7. Backend o frontend fa broadcast

8. Backend salva:
   - txid
   - owner corrente
   - last_sale_price
   - stato copia
```

---

## Rivendita

```text
1. Alice clicca "Vendi"
2. Sceglie prezzo
3. Backend controlla off-chain:
   - prezzo >= last_sale_price * 80%
   - prezzo <= last_sale_price * 120%

4. Bob clicca "Compra usato"
5. Frontend manda:
   - copy_id
   - new_buyer_address
   - new_sale_price

6. Backend costruisce transazione:
   input:
     - BookCopyContract di Alice
     - UTXO pagamento di Bob

   output:
     - nuovo BookCopyContract per Bob
     - pagamento Alice
     - royalty autore
     - fee sito
     - resto Bob

7. Alice firma la spesa del suo BookCopyContract
8. Bob firma il pagamento
9. Broadcast
10. Backend aggiorna owner e last_sale_price
```

---

# API da esporre al frontend

## Lista libri

```http
GET /api/books
```

Risposta:

```json
{
    "books": [
        {
            "id": "book_001",
            "title": "Libro esempio",
            "author": "Alice",
            "price": 100000,
            "assetId": "...",
            "copiesRemaining": 42
        }
    ]
}
```

---

## Preparare acquisto primario

```http
POST /api/books/book_001/buy/prepare
```

Body:

```json
{
    "buyerAddress": "tex1...",
    "paymentAsset": "LBTC",
    "buyerUtxos": []
}
```

Risposta:

```json
{
    "pset": "cHNldP8...",
    "summary": {
        "price": 100000,
        "authorAmount": 90000,
        "siteAmount": 10000,
        "bookOutputIndex": 1
    }
}
```

---

## Broadcast

```http
POST /api/tx/broadcast
```

Body:

```json
{
    "signedPset": "cHNldP8..."
}
```

Risposta:

```json
{
    "txid": "..."
}
```

---

## Mettere in vendita una copia

```http
POST /api/copies/copy_123/list
```

Body:

```json
{
    "sellerAddress": "tex1...",
    "price": 110000
}
```

Risposta:

```json
{
    "listingId": "listing_123",
    "validPriceRange": {
        "min": 80000,
        "max": 120000
    }
}
```

---

## Preparare acquisto usato

```http
POST /api/listings/listing_123/buy/prepare
```

Body:

```json
{
    "buyerAddress": "tex1...",
    "buyerUtxos": []
}
```

Risposta:

```json
{
    "pset": "cHNldP8...",
    "requiredSigners": ["seller", "buyer"],
    "summary": {
        "price": 110000,
        "sellerAmount": 88000,
        "authorRoyalty": 16500,
        "siteFee": 5500
    }
}
```

---

# Database minimo

```sql
CREATE TABLE books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_script_hash TEXT NOT NULL,
    site_script_hash TEXT NOT NULL,
    book_asset_id TEXT NOT NULL,
    payment_asset_id TEXT NOT NULL,
    initial_price INTEGER NOT NULL,
    sale_contract_utxo TEXT NOT NULL,
    copies_remaining INTEGER NOT NULL
);

CREATE TABLE book_copies (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    current_owner_script_hash TEXT NOT NULL,
    current_owner_pubkey TEXT NOT NULL,
    last_sale_price INTEGER NOT NULL,
    contract_utxo TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE listings (
    id TEXT PRIMARY KEY,
    copy_id TEXT NOT NULL,
    seller_script_hash TEXT NOT NULL,
    price INTEGER NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    txid TEXT,
    pset TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);
```

---

# Moduli logici importanti

## Split royalties

```ts
export function primarySplit(price: bigint) {
    const author = (price * 90n) / 100n;
    const site = price - author;

    return { author, site };
}

export function resaleSplit(price: bigint) {
    const seller = (price * 80n) / 100n;
    const author = (price * 15n) / 100n;
    const site = price - seller - author;

    return { seller, author, site };
}
```

## Range prezzo rivendita

```ts
export function getResaleRange(lastSalePrice: bigint) {
    const min = (lastSalePrice * 80n) / 100n;
    const max = (lastSalePrice * 120n) / 100n;

    return { min, max };
}

export function assertValidResalePrice(lastSalePrice: bigint, newPrice: bigint) {
    const { min, max } = getResaleRange(lastSalePrice);

    if (newPrice < min || newPrice > max) {
        throw new Error(`Invalid resale price. Allowed range: ${min}-${max}`);
    }
}
```

---

# Tree completo del progetto

```text
liquid-book-market/
├── README.md
├── .env.example
├── docker-compose.yml
├── package.json
├── tsconfig.json
│
├── contracts/
│   ├── README.md
│   ├── book_sale.simf
│   ├── book_copy.simf
│   ├── compiled/
│   │   ├── book_sale.json
│   │   └── book_copy.json
│   └── fixtures/
│       ├── book_sale_params.json
│       └── book_copy_params.json
│
├── src/
│   ├── index.ts
│   │
│   ├── api/
│   │   ├── routes.ts
│   │   ├── books.routes.ts
│   │   ├── copies.routes.ts
│   │   ├── listings.routes.ts
│   │   └── tx.routes.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   ├── liquid.ts
│   │   └── constants.ts
│   │
│   ├── domain/
│   │   ├── book.ts
│   │   ├── copy.ts
│   │   ├── listing.ts
│   │   └── royalty.ts
│   │
│   ├── liquid/
│   │   ├── client.ts
│   │   ├── utxos.ts
│   │   ├── assets.ts
│   │   ├── blinding.ts
│   │   ├── pset.ts
│   │   ├── broadcast.ts
│   │   └── explorer.ts
│   │
│   ├── contracts/
│   │   ├── bookSaleContract.ts
│   │   ├── bookCopyContract.ts
│   │   ├── scriptHash.ts
│   │   └── contractParams.ts
│   │
│   ├── tx-builder/
│   │   ├── buildPrimarySaleTx.ts
│   │   ├── buildResaleTx.ts
│   │   ├── outputs.ts
│   │   ├── inputs.ts
│   │   ├── fees.ts
│   │   └── validation.ts
│   │
│   ├── services/
│   │   ├── book.service.ts
│   │   ├── copy.service.ts
│   │   ├── listing.service.ts
│   │   └── transaction.service.ts
│   │
│   ├── db/
│   │   ├── schema.sql
│   │   ├── db.ts
│   │   └── migrations/
│   │       └── 001_init.sql
│   │
│   └── utils/
│       ├── math.ts
│       ├── errors.ts
│       └── serialization.ts
│
├── scripts/
│   ├── compile-contracts.sh
│   ├── issue-book-asset.ts
│   ├── deploy-book-sale.ts
│   ├── fund-test-wallet.ts
│   └── demo-primary-sale.ts
│
├── test/
│   ├── unit/
│   │   ├── royalty.test.ts
│   │   ├── price-range.test.ts
│   │   └── tx-builder.test.ts
│   │
│   ├── integration/
│   │   ├── primary-sale.test.ts
│   │   └── resale.test.ts
│   │
│   └── fixtures/
│       ├── books.json
│       ├── utxos.json
│       └── psets.json
│
└── docs/
    ├── architecture.md
    ├── api.md
    ├── transaction-flows.md
    └── contract-rules.md
```

---

# Tree ridotto per hackathon

```text
liquid-book-market/
├── contracts/
│   ├── book_sale.simf
│   └── book_copy.simf
│
├── src/
│   ├── server.ts
│   ├── db.ts
│   ├── liquid.ts
│   ├── royalty.ts
│   ├── buildPrimarySaleTx.ts
│   ├── buildResaleTx.ts
│   └── broadcast.ts
│
├── scripts/
│   ├── issueAsset.ts
│   ├── deploySaleContract.ts
│   └── demo.ts
│
├── test/
│   ├── primarySale.test.ts
│   └── resale.test.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

---

# Responsabilità dei file principali

## `contracts/book_sale.simf`

Contratto della vendita primaria.

Controlla:

```text
- esistono ancora copie;
- output 0 = BookSaleContract con stock - 1;
- output 1 = BookCopyContract per buyer;
- output 2 = pagamento autore 90%;
- output 3 = pagamento sito 10%.
```

## `contracts/book_copy.simf`

Contratto della copia già venduta.

Controlla:

```text
- firma del proprietario corrente;
- prezzo rivendita tra -20% e +20%;
- output 0 = nuovo BookCopyContract per nuovo buyer;
- output 1 = pagamento vecchio owner;
- output 2 = royalty autore;
- output 3 = fee sito.
```

## `src/tx-builder/buildPrimarySaleTx.ts`

Responsabilità:

```text
- caricare dati libro;
- selezionare UTXO del BookSaleContract;
- costruire output autore/sito;
- costruire output BookCopyContract;
- costruire nuovo output BookSaleContract;
- calcolare fee/change;
- restituire PSET.
```

Input previsto:

```ts
{
  bookId: string;
  buyerAddress: string;
  buyerPaymentUtxos: Utxo[];
}
```

Output previsto:

```ts
{
    psetBase64: string;
    requiredSigners: ["buyer"];
}
```

## `src/tx-builder/buildResaleTx.ts`

Responsabilità:

```text
- caricare copia corrente;
- controllare prezzo minimo/massimo;
- selezionare UTXO BookCopyContract;
- creare nuovo BookCopyContract per buyer;
- pagare seller/autore/sito;
- calcolare fee/change;
- restituire PSET.
```

Input previsto:

```ts
{
  copyId: string;
  buyerAddress: string;
  newSalePrice: number;
  buyerPaymentUtxos: Utxo[];
}
```

Output previsto:

```ts
{
    psetBase64: string;
    requiredSigners: ["seller", "buyer"];
}
```

---

# Roadmap consigliata

## Fase 1 — Mock senza Liquid e senza Simplicity

Obiettivo: permettere al sito di integrarsi subito.

Da implementare:

```text
- API compra libro;
- API rivendi libro;
- database minimo;
- calcolo percentuali;
- controllo prezzo ±20%;
- costruzione finta della transazione;
- response JSON compatibile con il frontend.
```

Output della fase:

```text
Frontend già in grado di chiamare:
POST /api/books/:bookId/buy/prepare
POST /api/listings/:listingId/buy/prepare
```

---

## Fase 2 — Liquid testnet/regtest senza covenant

Obiettivo: imparare e validare la parte Liquid pura.

Da implementare:

```text
- issuance asset libro;
- creazione asset_id;
- pagamento autore/sito;
- trasferimento asset;
- gestione UTXO;
- gestione change;
- gestione fee;
- broadcast transazione;
- salvataggio txid.
```

Output della fase:

```text
Transazione Liquid reale che trasferisce asset e pagamenti, anche se senza regole persistenti Simplicity.
```

---

## Fase 3 — BookSaleContract

Obiettivo: introdurre il contratto per vendita primaria.

Da implementare:

```text
- contracts/book_sale.simf;
- compilazione contratto;
- deploy/funding UTXO del contratto;
- costruzione transazione di acquisto primario;
- controllo stock - 1;
- creazione BookCopyContract per buyer;
- pagamento autore 90%;
- pagamento sito 10%.
```

Output della fase:

```text
Una vendita primaria produce una copia vincolata dal BookCopyContract.
```

---

## Fase 4 — BookCopyContract

Obiettivo: gestire la rivendita con regole persistenti.

Da implementare:

```text
- contracts/book_copy.simf;
- firma del current_owner;
- controllo prezzo tra -20% e +20%;
- pagamento seller/autore/sito;
- creazione nuovo BookCopyContract;
- aggiornamento owner;
- aggiornamento last_sale_price.
```

Output della fase:

```text
Una copia può essere rivenduta e il nuovo buyer riceve una nuova copia ancora vincolata dalle stesse regole.
```

---

## Fase 5 — Integrazione completa con frontend

Obiettivo: collegare tutto al sito.

Da implementare:

```text
- endpoint definitivi;
- gestione wallet/signature flow;
- stati transazione: prepared, signed, broadcasted, confirmed, failed;
- pagine frontend collegate alle API;
- refresh stato libro/copia/listing;
- gestione errori utente;
- demo completa.
```

Output della fase:

```text
Click su Compra o Compra usato → PSET → firma wallet → broadcast → aggiornamento marketplace.
```

---

## Fase 6 — Demo finale hackathon

Obiettivo: rendere il progetto presentabile.

Demo consigliata:

```text
1. Creo un libro con 3 copie.
2. Buyer Alice compra una copia dal sito.
3. Si vede che:
   - stock scende da 3 a 2;
   - autore riceve 90%;
   - sito riceve 10%;
   - Alice riceve BookCopyContract.

4. Alice mette in vendita a +10%.
5. Bob compra.
6. Si vede che:
   - prezzo è nel range valido;
   - Alice riceve la quota seller;
   - autore riceve royalty;
   - sito riceve fee;
   - Bob riceve nuovo BookCopyContract.

7. Si prova a rivendere fuori range, per esempio +50%.
8. La transazione viene rifiutata.
```

---

# Priorità pratica

Per hackathon, priorità consigliata:

```text
1. Modellare bene primary sale e resale.
2. Fare API mock compatibili col frontend.
3. Fare calcolo quote e range prezzo.
4. Costruire transazioni Liquid semplici.
5. Integrare Simplicity solo dove serve per la demo.
6. Avere una demo end-to-end, anche con qualche parte semplificata.
```

Meglio una demo piccola ma funzionante che un sistema teoricamente completo ma non dimostrabile.

---

# Riassunto finale

Il sistema deve funzionare così:

```text
Vendita primaria:
BookSaleContract
    ↓
BookCopyContract(owner = buyer, last_sale_price = prezzo iniziale)

Rivendita:
BookCopyContract(owner = seller, last_sale_price = old_price)
    ↓
BookCopyContract(owner = new_buyer, last_sale_price = new_price)
```

Regola di prezzo:

```text
old_price * 80% <= new_price <= old_price * 120%
```

Pagamenti:

```text
Vendita primaria:
  90% autore
  10% sito

Rivendita:
  quota al venditore
  royalty autore
  fee sito
```

Ponte tecnico da implementare:

```text
click sito
  ↓
API backend
  ↓
costruzione PSET Liquid
  ↓
firma wallet
  ↓
broadcast
  ↓
aggiornamento stato
```
