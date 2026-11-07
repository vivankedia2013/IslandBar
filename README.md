# IslandBar
A tiny dynamic island for Windows 10/11 and macOS 11 (Big Sur)+. Built with Tauri (~5-10 MB, low idle RAM).

**Features:** notch or circle shape (switch from tray icon), hover to expand, focus/break timer shown in the pill,
local media player, system master volume, Claude chat (Anthropic API key), Esc to collapse.

## Build installers (GitHub)
1. Push this repo to GitHub.
2. `git tag v0.1.0 && git push --tags`
3. Actions builds a Windows `.exe` installer and a universal macOS `.dmg`, attached to the Release.

## Run locally
Requires Node 18+, Rust, and the Tauri prerequisites for your OS.
```
npm install
npx tauri icon assets/icon.png
npm run dev
```
## Notes
- Builds are unsigned: Windows SmartScreen / macOS Gatekeeper will warn (right-click > Open on Mac).
- On macOS the island sits below the menu bar unless the window level is raised (see roadmap).
- Roadmap: control other apps' playback (media keys), launch at login, notch-aware placement on MacBooks.

## Offline
Everything except the Claude chat works with no internet. The Windows installer downloads WebView2 only if it is missing.
To bundle it for fully offline installs, set `"webviewInstallMode": {"type": "offlineInstaller"}` in `src-tauri/tauri.conf.json` (+~120 MB).
Tray icon menu: Notch shape / Circle shape / Launch at login / Quit.

## Supported systems
Windows 10 and 11 (x64) · macOS Big Sur 11 and newer (Intel + Apple Silicon, universal).

## Build on your own machine instead of GitHub
- Windows: `powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1`
- macOS: `./scripts/build-macos.sh`
