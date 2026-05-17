use std::collections::HashMap;

use simplex::program::{ArgumentsTrait, Program, ProgramTrait, WitnessTrait};
use simplex::provider::SimplicityNetwork;
use simplex::signer::SignerTrait;
use simplex::simplicityhl::elements::EcdsaSighashType;
use simplex::simplicityhl::elements::confidential::{Asset, Value as ConfidentialValue};
use simplex::simplicityhl::elements::pset::PartiallySignedTransaction;
use simplex::simplicityhl::elements::schnorr::TweakedPublicKey;
use simplex::simplicityhl::elements::secp256k1_zkp::{Secp256k1, XOnlyPublicKey, schnorr};
use simplex::simplicityhl::elements::{AssetId, Script, TxOut};
use simplex::simplicityhl::num::U256;
use simplex::simplicityhl::str::WitnessName;
use simplex::simplicityhl::value::{UIntValue, ValueConstructible};
use simplex::simplicityhl::{Arguments, Value, WitnessValues};
use simplex::transaction::{PartialInput, PartialOutput, UTXO};

pub const LICENSE_RESALE_SOURCE: &str = include_str!("../license_resale.simf");

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LicenseResaleParameters {
    pub license_asset_id: AssetId,
    pub payment_asset_id: AssetId,
    pub creator_pubkey: XOnlyPublicKey,
    pub min_resale_price: u64,
    pub max_resale_price: u64,
    pub royalty_bps: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResaleTerms {
    pub sale_price: u64,
    pub sold_license_copies: u64,
    pub fee_amount: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResaleAmounts {
    pub seller_payment: u64,
    pub royalty_payment: u64,
    pub buyer_change: u64,
    pub remaining_license_copies: u64,
}

#[derive(Debug, Clone)]
pub struct UnsignedResale {
    pub pst: PartiallySignedTransaction,
    pub amounts: ResaleAmounts,
}

#[derive(Debug, thiserror::Error)]
pub enum LicenseResaleError {
    #[error("sale price {sale_price} is below minimum {min}")]
    PriceBelowMinimum { sale_price: u64, min: u64 },
    #[error("sale price {sale_price} is above maximum {max}")]
    PriceAboveMaximum { sale_price: u64, max: u64 },
    #[error("royalty basis points must be <= 10000, got {0}")]
    InvalidRoyaltyBps(u64),
    #[error("missing explicit asset or amount on {0}")]
    ConfidentialOrMissing(&'static str),
    #[error("expected {expected} on {field}, got {actual}")]
    WrongAsset {
        field: &'static str,
        expected: AssetId,
        actual: AssetId,
    },
    #[error("sold copies must be at least 1")]
    ZeroSoldCopies,
    #[error("sold {sold} copies but license input only has {available}")]
    NotEnoughLicenseCopies { sold: u64, available: u64 },
    #[error("strict MVP layout requires output 1 to hold at least one remaining license copy")]
    NoRemainingCopies,
    #[error("payment input {available} is smaller than sale price plus fee {needed}")]
    NotEnoughPayment { available: u64, needed: u64 },
    #[error(
        "fee output requires PAYMENT_ASSET_ID to be the network policy asset in the 2-input layout"
    )]
    FeeRequiresPolicyPaymentAsset,
    #[error("arithmetic overflow")]
    ArithmeticOverflow,
    #[error("simplicity program error: {0}")]
    Program(#[from] simplex::program::ProgramError),
    #[error("signer error: {0}")]
    Signer(#[from] simplex::signer::SignerError),
}

#[derive(Clone)]
struct LicenseResaleArguments(LicenseResaleParameters);

impl ArgumentsTrait for LicenseResaleArguments {
    fn build_arguments(&self) -> Arguments {
        let params = self.0;
        Arguments::from(HashMap::from([
            u256_arg("LICENSE_ASSET_ID", params.license_asset_id.into_inner().0),
            u256_arg("PAYMENT_ASSET_ID", params.payment_asset_id.into_inner().0),
            u256_arg("CREATOR_PUBKEY", params.creator_pubkey.serialize()),
            u64_arg("MIN_RESALE_PRICE", params.min_resale_price),
            u64_arg("MAX_RESALE_PRICE", params.max_resale_price),
            u64_arg("ROYALTY_BPS", params.royalty_bps),
        ]))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LicenseResaleWitness {
    pub seller_pubkey: XOnlyPublicKey,
    pub buyer_pubkey: XOnlyPublicKey,
    pub sale_price: u64,
    pub sold_license_copies: u64,
    pub fee_amount: u64,
    pub has_fee_output: bool,
    pub seller_signature: schnorr::Signature,
}

impl WitnessTrait for LicenseResaleWitness {
    fn build_witness(&self) -> WitnessValues {
        WitnessValues::from(HashMap::from([
            u256_witness("SELLER_PUBKEY", self.seller_pubkey.serialize()),
            u256_witness("BUYER_PUBKEY", self.buyer_pubkey.serialize()),
            u64_witness("SALE_PRICE", self.sale_price),
            u64_witness("SOLD_LICENSE_COPIES", self.sold_license_copies),
            u64_witness("FEE_AMOUNT", self.fee_amount),
            bool_witness("HAS_FEE_OUTPUT", self.has_fee_output),
            (
                WitnessName::from_str_unchecked("SELLER_SIGNATURE"),
                Value::byte_array(self.seller_signature.serialize()),
            ),
        ]))
    }
}

#[derive(Clone)]
pub struct LicenseResaleContract {
    params: LicenseResaleParameters,
    program: Program,
}

impl LicenseResaleContract {
    #[must_use]
    pub fn new(params: LicenseResaleParameters) -> Self {
        let program = Program::new(
            LICENSE_RESALE_SOURCE,
            Box::new(LicenseResaleArguments(params)),
        )
        .with_storage_capacity(1);

        Self { params, program }
    }

    #[must_use]
    pub const fn parameters(&self) -> LicenseResaleParameters {
        self.params
    }

    #[must_use]
    pub fn program(&self) -> &Program {
        &self.program
    }

    #[must_use]
    pub fn for_owner(&self, owner: XOnlyPublicKey) -> Program {
        let mut program = self.program.clone();
        program.set_storage_at(0, owner.serialize());
        program
    }

    #[must_use]
    pub fn covenant_script_for_owner(
        &self,
        owner: XOnlyPublicKey,
        network: &SimplicityNetwork,
    ) -> Script {
        self.for_owner(owner).get_script_pubkey(network)
    }

    #[must_use]
    pub fn direct_key_script(owner: XOnlyPublicKey) -> Script {
        Script::new_v1_p2tr_tweaked(TweakedPublicKey::new(owner))
    }

    /// Build the strict 2-input resale PSET expected by `license_resale.simf`.
    ///
    /// The returned PSET is not finalized. Call `sign_and_finalize_resale_input`
    /// after the seller signature is available.
    ///
    /// # Errors
    /// Returns an error when the requested terms violate contract policy or when
    /// the provided UTXOs are not explicit and in the expected assets.
    pub fn build_unsigned_resale(
        &self,
        license_utxo: UTXO,
        payment_utxo: UTXO,
        seller_pubkey: XOnlyPublicKey,
        buyer_pubkey: XOnlyPublicKey,
        terms: ResaleTerms,
        network: &SimplicityNetwork,
    ) -> Result<UnsignedResale, LicenseResaleError> {
        let amounts = self.compute_amounts(&license_utxo, &payment_utxo, terms, network)?;

        let mut pst = PartiallySignedTransaction::new_v2();
        pst.add_input(PartialInput::new(license_utxo).to_input());
        pst.add_input(PartialInput::new(payment_utxo).to_input());

        pst.add_output(
            PartialOutput::new(
                self.covenant_script_for_owner(buyer_pubkey, network),
                terms.sold_license_copies,
                self.params.license_asset_id,
            )
            .to_output(),
        );
        pst.add_output(
            PartialOutput::new(
                self.covenant_script_for_owner(seller_pubkey, network),
                amounts.remaining_license_copies,
                self.params.license_asset_id,
            )
            .to_output(),
        );
        pst.add_output(
            PartialOutput::new(
                Self::direct_key_script(seller_pubkey),
                amounts.seller_payment,
                self.params.payment_asset_id,
            )
            .to_output(),
        );
        pst.add_output(
            PartialOutput::new(
                Self::direct_key_script(self.params.creator_pubkey),
                amounts.royalty_payment,
                self.params.payment_asset_id,
            )
            .to_output(),
        );
        pst.add_output(
            PartialOutput::new(
                Self::direct_key_script(buyer_pubkey),
                amounts.buyer_change,
                self.params.payment_asset_id,
            )
            .to_output(),
        );

        if terms.fee_amount > 0 {
            pst.add_output(
                PartialOutput::new(
                    Script::new(),
                    terms.fee_amount,
                    self.params.payment_asset_id,
                )
                .to_output(),
            );
        }

        Ok(UnsignedResale { pst, amounts })
    }

    /// Sign with the seller's LWK/Simplex signer and finalize input 0.
    ///
    /// This only finalizes the covenant input. The buyer payment input at index 1
    /// still has to be signed by the buyer wallet unless it is otherwise already
    /// satisfied by the transaction builder.
    ///
    /// # Errors
    /// Returns an error if the Simplicity environment cannot be built, signing
    /// fails, or finalization fails.
    pub fn sign_and_finalize_resale_input(
        &self,
        pst: &mut PartiallySignedTransaction,
        seller: &dyn SignerTrait,
        seller_pubkey: XOnlyPublicKey,
        buyer_pubkey: XOnlyPublicKey,
        terms: ResaleTerms,
        network: &SimplicityNetwork,
    ) -> Result<LicenseResaleWitness, LicenseResaleError> {
        let seller_program = self.for_owner(seller_pubkey);
        let signature = seller.sign_program(pst, &seller_program, 0, network)?;
        let witness = LicenseResaleWitness {
            seller_pubkey,
            buyer_pubkey,
            sale_price: terms.sale_price,
            sold_license_copies: terms.sold_license_copies,
            fee_amount: terms.fee_amount,
            has_fee_output: terms.fee_amount > 0,
            seller_signature: signature,
        };

        pst.inputs_mut()[0].final_script_witness =
            Some(seller_program.finalize(pst, &witness.build_witness(), 0, network)?);

        Ok(witness)
    }

    /// Sign the buyer payment input at index 1 as a standard native ECDSA input.
    ///
    /// This helper matches the Simplex/LWK examples: the witness is
    /// `[DER_SIGNATURE || SIGHASH_ALL, COMPRESSED_PUBLIC_KEY]`.
    ///
    /// # Errors
    /// Returns an error if the buyer signer cannot produce a signature.
    pub fn sign_buyer_payment_input(
        pst: &mut PartiallySignedTransaction,
        buyer: &dyn SignerTrait,
    ) -> Result<(), LicenseResaleError> {
        let (public_key, signature) = buyer.sign_input(pst, 1)?;
        let mut raw_sig = signature.serialize_der().to_vec();
        raw_sig.push(EcdsaSighashType::All as u8);
        pst.inputs_mut()[1].final_script_witness = Some(vec![raw_sig, public_key.to_bytes()]);

        Ok(())
    }

    fn compute_amounts(
        &self,
        license_utxo: &UTXO,
        payment_utxo: &UTXO,
        terms: ResaleTerms,
        network: &SimplicityNetwork,
    ) -> Result<ResaleAmounts, LicenseResaleError> {
        if self.params.royalty_bps > 10_000 {
            return Err(LicenseResaleError::InvalidRoyaltyBps(
                self.params.royalty_bps,
            ));
        }
        if terms.sale_price < self.params.min_resale_price {
            return Err(LicenseResaleError::PriceBelowMinimum {
                sale_price: terms.sale_price,
                min: self.params.min_resale_price,
            });
        }
        if terms.sale_price > self.params.max_resale_price {
            return Err(LicenseResaleError::PriceAboveMaximum {
                sale_price: terms.sale_price,
                max: self.params.max_resale_price,
            });
        }
        if terms.sold_license_copies == 0 {
            return Err(LicenseResaleError::ZeroSoldCopies);
        }
        if terms.fee_amount > 0 && self.params.payment_asset_id != network.policy_asset() {
            return Err(LicenseResaleError::FeeRequiresPolicyPaymentAsset);
        }

        let (license_asset, license_amount) = explicit_asset_amount(license_utxo, "license input")?;
        if license_asset != self.params.license_asset_id {
            return Err(LicenseResaleError::WrongAsset {
                field: "license input",
                expected: self.params.license_asset_id,
                actual: license_asset,
            });
        }

        let (payment_asset, payment_amount) = explicit_asset_amount(payment_utxo, "payment input")?;
        if payment_asset != self.params.payment_asset_id {
            return Err(LicenseResaleError::WrongAsset {
                field: "payment input",
                expected: self.params.payment_asset_id,
                actual: payment_asset,
            });
        }

        if terms.sold_license_copies > license_amount {
            return Err(LicenseResaleError::NotEnoughLicenseCopies {
                sold: terms.sold_license_copies,
                available: license_amount,
            });
        }

        let remaining_license_copies = license_amount
            .checked_sub(terms.sold_license_copies)
            .ok_or(LicenseResaleError::ArithmeticOverflow)?;
        if remaining_license_copies == 0 {
            return Err(LicenseResaleError::NoRemainingCopies);
        }

        let royalty_payment = royalty_amount(terms.sale_price, self.params.royalty_bps)?;
        let seller_payment = terms
            .sale_price
            .checked_sub(royalty_payment)
            .ok_or(LicenseResaleError::ArithmeticOverflow)?;
        let needed = terms
            .sale_price
            .checked_add(terms.fee_amount)
            .ok_or(LicenseResaleError::ArithmeticOverflow)?;
        if payment_amount < needed {
            return Err(LicenseResaleError::NotEnoughPayment {
                available: payment_amount,
                needed,
            });
        }
        let buyer_change = payment_amount
            .checked_sub(needed)
            .ok_or(LicenseResaleError::ArithmeticOverflow)?;

        Ok(ResaleAmounts {
            seller_payment,
            royalty_payment,
            buyer_change,
            remaining_license_copies,
        })
    }
}

fn explicit_asset_amount(
    utxo: &UTXO,
    field: &'static str,
) -> Result<(AssetId, u64), LicenseResaleError> {
    let asset = match utxo.txout.asset {
        Asset::Explicit(asset) => asset,
        _ => return Err(LicenseResaleError::ConfidentialOrMissing(field)),
    };
    let amount = match utxo.txout.value {
        ConfidentialValue::Explicit(value) => value,
        _ => return Err(LicenseResaleError::ConfidentialOrMissing(field)),
    };
    Ok((asset, amount))
}

fn royalty_amount(sale_price: u64, royalty_bps: u64) -> Result<u64, LicenseResaleError> {
    sale_price
        .checked_mul(royalty_bps)
        .ok_or(LicenseResaleError::ArithmeticOverflow)
        .map(|product| product / 10_000)
}

fn u256_arg(name: &'static str, bytes: [u8; 32]) -> (WitnessName, Value) {
    (
        WitnessName::from_str_unchecked(name),
        Value::from(UIntValue::U256(U256::from_byte_array(bytes))),
    )
}

fn u64_arg(name: &'static str, value: u64) -> (WitnessName, Value) {
    (
        WitnessName::from_str_unchecked(name),
        Value::from(UIntValue::U64(value)),
    )
}

fn u256_witness(name: &'static str, bytes: [u8; 32]) -> (WitnessName, Value) {
    u256_arg(name, bytes)
}

fn u64_witness(name: &'static str, value: u64) -> (WitnessName, Value) {
    u64_arg(name, value)
}

fn bool_witness(name: &'static str, value: bool) -> (WitnessName, Value) {
    (WitnessName::from_str_unchecked(name), Value::from(value))
}

#[must_use]
pub fn explicit_utxo(outpoint: simplex::simplicityhl::elements::OutPoint, txout: TxOut) -> UTXO {
    UTXO {
        outpoint,
        txout,
        secrets: None,
    }
}

#[must_use]
pub fn explicit_txout(script_pubkey: Script, amount: u64, asset: AssetId) -> TxOut {
    TxOut {
        asset: Asset::Explicit(asset),
        value: ConfidentialValue::Explicit(amount),
        script_pubkey,
        ..Default::default()
    }
}

#[must_use]
pub fn test_keypair(secret_byte: u8) -> simplex::simplicityhl::elements::secp256k1_zkp::Keypair {
    use simplex::simplicityhl::elements::secp256k1_zkp::{Keypair, SecretKey};

    let secp = Secp256k1::new();
    let secret = SecretKey::from_slice(&[secret_byte; 32]).expect("valid test secret key");
    Keypair::from_secret_key(&secp, &secret)
}

#[must_use]
pub fn xonly_from_keypair(
    keypair: &simplex::simplicityhl::elements::secp256k1_zkp::Keypair,
) -> XOnlyPublicKey {
    keypair.x_only_public_key().0
}

#[cfg(test)]
mod tests {
    use simplex::simplicityhl::elements::hashes::Hash;
    use simplex::simplicityhl::elements::secp256k1_zkp::Message;
    use simplex::simplicityhl::elements::{OutPoint, Txid};

    use super::*;

    fn dummy_asset(byte: u8) -> AssetId {
        AssetId::from_slice(&[byte; 32]).unwrap()
    }

    fn dummy_outpoint(byte: u8, vout: u32) -> OutPoint {
        OutPoint::new(Txid::from_slice(&[byte; 32]).unwrap(), vout)
    }

    fn contract_with_policy_payment() -> (LicenseResaleContract, SimplicityNetwork) {
        let network = SimplicityNetwork::default_regtest();
        let creator = xonly_from_keypair(&test_keypair(1));
        let params = LicenseResaleParameters {
            license_asset_id: dummy_asset(0x11),
            payment_asset_id: network.policy_asset(),
            creator_pubkey: creator,
            min_resale_price: 1,
            max_resale_price: 7_000,
            royalty_bps: 1_000,
        };
        (LicenseResaleContract::new(params), network)
    }

    #[test]
    fn computes_resale_amounts_and_layout() -> anyhow::Result<()> {
        let (contract, network) = contract_with_policy_payment();
        let seller = xonly_from_keypair(&test_keypair(2));
        let buyer = xonly_from_keypair(&test_keypair(3));

        let license_utxo = explicit_utxo(
            dummy_outpoint(0xA1, 0),
            explicit_txout(
                contract.covenant_script_for_owner(seller, &network),
                10,
                contract.parameters().license_asset_id,
            ),
        );
        let payment_utxo = explicit_utxo(
            dummy_outpoint(0xB1, 1),
            explicit_txout(
                LicenseResaleContract::direct_key_script(buyer),
                6_500,
                contract.parameters().payment_asset_id,
            ),
        );

        let unsigned = contract.build_unsigned_resale(
            license_utxo,
            payment_utxo,
            seller,
            buyer,
            ResaleTerms {
                sale_price: 6_000,
                sold_license_copies: 1,
                fee_amount: 500,
            },
            &network,
        )?;

        assert_eq!(unsigned.pst.inputs().len(), 2);
        assert_eq!(unsigned.pst.outputs().len(), 6);
        assert_eq!(unsigned.amounts.royalty_payment, 600);
        assert_eq!(unsigned.amounts.seller_payment, 5_400);
        assert_eq!(unsigned.amounts.buyer_change, 0);
        assert_eq!(unsigned.amounts.remaining_license_copies, 9);

        Ok(())
    }

    #[test]
    fn rejects_price_above_cap() {
        let (contract, network) = contract_with_policy_payment();
        let seller = xonly_from_keypair(&test_keypair(2));
        let buyer = xonly_from_keypair(&test_keypair(3));
        let license_utxo = explicit_utxo(
            dummy_outpoint(0xA1, 0),
            explicit_txout(
                contract.covenant_script_for_owner(seller, &network),
                10,
                contract.parameters().license_asset_id,
            ),
        );
        let payment_utxo = explicit_utxo(
            dummy_outpoint(0xB1, 1),
            explicit_txout(
                LicenseResaleContract::direct_key_script(buyer),
                10_000,
                contract.parameters().payment_asset_id,
            ),
        );

        let err = contract
            .build_unsigned_resale(
                license_utxo,
                payment_utxo,
                seller,
                buyer,
                ResaleTerms {
                    sale_price: 8_000,
                    sold_license_copies: 1,
                    fee_amount: 0,
                },
                &network,
            )
            .unwrap_err();

        assert!(matches!(err, LicenseResaleError::PriceAboveMaximum { .. }));
    }

    #[test]
    fn finalizes_valid_contract_witness() -> anyhow::Result<()> {
        let (contract, network) = contract_with_policy_payment();
        let seller_keypair = test_keypair(2);
        let seller = xonly_from_keypair(&seller_keypair);
        let buyer = xonly_from_keypair(&test_keypair(3));
        let terms = ResaleTerms {
            sale_price: 6_000,
            sold_license_copies: 1,
            fee_amount: 500,
        };

        let license_utxo = explicit_utxo(
            dummy_outpoint(0xA1, 0),
            explicit_txout(
                contract.covenant_script_for_owner(seller, &network),
                10,
                contract.parameters().license_asset_id,
            ),
        );
        let payment_utxo = explicit_utxo(
            dummy_outpoint(0xB1, 1),
            explicit_txout(
                LicenseResaleContract::direct_key_script(buyer),
                6_500,
                contract.parameters().payment_asset_id,
            ),
        );

        let unsigned = contract.build_unsigned_resale(
            license_utxo,
            payment_utxo,
            seller,
            buyer,
            terms,
            &network,
        )?;
        let seller_program = contract.for_owner(seller);
        let env = seller_program.get_env(&unsigned.pst, 0, &network)?;
        let msg = Message::from_digest(env.c_tx_env().sighash_all().to_byte_array());
        let signature = Secp256k1::new().sign_schnorr(&msg, &seller_keypair);
        let witness = LicenseResaleWitness {
            seller_pubkey: seller,
            buyer_pubkey: buyer,
            sale_price: terms.sale_price,
            sold_license_copies: terms.sold_license_copies,
            fee_amount: terms.fee_amount,
            has_fee_output: true,
            seller_signature: signature,
        };

        let final_witness =
            seller_program.finalize(&unsigned.pst, &witness.build_witness(), 0, &network)?;

        assert_eq!(final_witness.len(), 4);
        Ok(())
    }

    #[test]
    fn contract_rejects_underpaid_royalty_output() -> anyhow::Result<()> {
        let (contract, network) = contract_with_policy_payment();
        let seller_keypair = test_keypair(2);
        let seller = xonly_from_keypair(&seller_keypair);
        let buyer = xonly_from_keypair(&test_keypair(3));
        let terms = ResaleTerms {
            sale_price: 6_000,
            sold_license_copies: 1,
            fee_amount: 500,
        };

        let license_utxo = explicit_utxo(
            dummy_outpoint(0xA1, 0),
            explicit_txout(
                contract.covenant_script_for_owner(seller, &network),
                10,
                contract.parameters().license_asset_id,
            ),
        );
        let payment_utxo = explicit_utxo(
            dummy_outpoint(0xB1, 1),
            explicit_txout(
                LicenseResaleContract::direct_key_script(buyer),
                6_500,
                contract.parameters().payment_asset_id,
            ),
        );

        let mut unsigned = contract.build_unsigned_resale(
            license_utxo,
            payment_utxo,
            seller,
            buyer,
            terms,
            &network,
        )?;
        unsigned.pst.outputs_mut()[3].amount = Some(599);

        let seller_program = contract.for_owner(seller);
        let env = seller_program.get_env(&unsigned.pst, 0, &network)?;
        let msg = Message::from_digest(env.c_tx_env().sighash_all().to_byte_array());
        let signature = Secp256k1::new().sign_schnorr(&msg, &seller_keypair);
        let witness = LicenseResaleWitness {
            seller_pubkey: seller,
            buyer_pubkey: buyer,
            sale_price: terms.sale_price,
            sold_license_copies: terms.sold_license_copies,
            fee_amount: terms.fee_amount,
            has_fee_output: true,
            seller_signature: signature,
        };

        assert!(
            seller_program
                .finalize(&unsigned.pst, &witness.build_witness(), 0, &network)
                .is_err()
        );

        Ok(())
    }
}
