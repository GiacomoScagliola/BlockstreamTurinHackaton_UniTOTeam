# License Resale Rust Builder

Rust transaction-builder crate for the License Resale Simplicity covenant.

The canonical Simplicity source lives at:

```text
../simplicity/license_resale.simf
```

The crate embeds that source with `include_str!`, builds the strict resale PSET layout, finalizes the covenant input, and exposes a CLI used by the web demo.

## Commands

```bash
cargo test
cargo run --bin license-resale-cli -- prepare-resale examples/prepare-resale.sample.json
```

The CLI prints JSON containing the base64 PSET, required signers, and a covenant summary.
