#!/bin/bash
# Run on a Mac (Intel or Apple Silicon). Needs: Node 18+, Rust (https://rustup.rs), Xcode command line tools.
set -e
export MACOSX_DEPLOYMENT_TARGET=11.0   # Big Sur and newer
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm install
npx tauri icon assets/icon.png
npm run build -- --target universal-apple-darwin
echo "Installer: src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg"
