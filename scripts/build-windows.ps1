# Run in PowerShell on Windows 10/11. Needs: Node 18+, Rust (https://rustup.rs), VS Build Tools (C++ workload).
$ErrorActionPreference = "Stop"
npm install
npx tauri icon assets/icon.png
npm run build
Write-Host "Installer: src-tauri\target\release\bundle\nsis\*.exe (and \msi\*.msi)"
