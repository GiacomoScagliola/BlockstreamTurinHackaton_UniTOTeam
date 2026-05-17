var LBTC_TESTNET_ASSET = '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49';

var books = [
  {
    id: 'book_001',
    bookId: 'book_001',
    title: 'Simplicity for Builders',
    authorName: 'Alice Author',
    bookAssetId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    paymentAssetId: LBTC_TESTNET_ASSET,
    initialPrice: 100000,
    authorPubkey: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    minResalePrice: 80000,
    maxResalePrice: 120000,
    royaltyBps: 1500,
    authorAddress: 'tlq1qqauthoraddressreplace000000000000000000000000000000000000000',
    authorScriptHash: 'author_script_hash_demo',
    siteAddress: 'tlq1qqsiteaddressreplace00000000000000000000000000000000000000000',
    siteScriptHash: 'site_script_hash_demo',
    copiesRemaining: 3,
    saleContractUtxo: 'sale_contract_txid_demo:0'
  },
  {
    id: 'book_002',
    bookId: 'book_002',
    title: 'Liquid Covenants Handbook',
    authorName: 'Bob Writer',
    bookAssetId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    paymentAssetId: LBTC_TESTNET_ASSET,
    initialPrice: 150000,
    authorPubkey: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    minResalePrice: 120000,
    maxResalePrice: 180000,
    royaltyBps: 1500,
    authorAddress: 'tlq1qqauthoraddressreplace111111111111111111111111111111111111111',
    authorScriptHash: 'author_script_hash_demo_2',
    siteAddress: 'tlq1qqsiteaddressreplace00000000000000000000000000000000000000000',
    siteScriptHash: 'site_script_hash_demo',
    copiesRemaining: 5,
    saleContractUtxo: 'sale_contract_txid_demo_2:0'
  }
];

var copies = [
  {
    id: 'copy_001',
    copyId: 'copy_001',
    bookId: 'book_001',
    currentOwnerAddress: 'tlq1qqselleraddressreplace0000000000000000000000000000000000000',
    currentOwnerScriptHash: 'seller_script_hash_demo',
    currentOwnerPubkey: 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    lastSalePrice: 100000,
    contractUtxo: 'book_copy_txid_demo:0',
    contractUtxoDetails: {
      txid: '1111111111111111111111111111111111111111111111111111111111111111',
      vout: 0,
      amount: 2
    },
    status: 'listed'
  }
];

var listings = [
  {
    id: 'listing_001',
    listingId: 'listing_001',
    copyId: 'copy_001',
    sellerAddress: 'tlq1qqselleraddressreplace0000000000000000000000000000000000000',
    sellerScriptHash: 'seller_script_hash_demo',
    sellerPubkey: 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    price: 110000,
    status: 'active'
  }
];

function findBook(bookId) {
  return books.find(function(book) {
    return book.id === bookId || book.bookId === bookId;
  });
}

function findCopy(copyId) {
  return copies.find(function(copy) {
    return copy.id === copyId || copy.copyId === copyId;
  });
}

function findListing(listingId) {
  return listings.find(function(listing) {
    return listing.id === listingId || listing.listingId === listingId;
  });
}

function addListing(listing) {
  listings.push(listing);
  return listing;
}

module.exports = {
  LBTC_TESTNET_ASSET: LBTC_TESTNET_ASSET,
  books: books,
  copies: copies,
  listings: listings,
  findBook: findBook,
  findCopy: findCopy,
  findListing: findListing,
  addListing: addListing
};
