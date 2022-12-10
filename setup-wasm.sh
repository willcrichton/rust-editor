git clone https://github.com/rust-analyzer/rust-analyzer-wasm
rustup toolchain install nightly-2021-11-02 --profile minimal -c rust-src
pushd rust-analyzer-wasm
git checkout 466bf192c3cbaa943fd5bb7fe502978111957e41
cd rust-pack
cargo run
cd ../ra-wasm
wasm-pack build --target web --profiling
