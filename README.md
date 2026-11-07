# IslandBar
A tiny dynamic island for Windows 10/11 and macOS 11 (Big Sur)+. Built with Tauri (~5-10 MB, low idle RAM).

**Features:** notch or circle shape (switch from tray icon), hover to expand, focus/break timer shown in the pill,
local media player, live music control of other apps, weather, system master volume, Claude chat (Anthropic API key), Esc to collapse.

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

## Live music control
- Windows 10/11: shows and controls whatever is playing (browser, Spotify, etc.) via the system media API.
- macOS: anything playing, including browsers, via the system media interface (macOS 11 to 15.3). On macOS 15.4+ Apple blocks this for third-party apps, so only Spotify and Apple Music work there (allow the permission prompt).

## Weather
Uses Open-Meteo (free, no key). Auto-detects your city from your IP, or search a city. Cached, so it shows the last result offline.

## Claude usage tab (📊)
Shows tokens used today by chats made inside IslandBar, plus the API rate-limit remaining and reset time when the server reports it.
It cannot show claude.ai subscription limits (no public API for that); use the "Open claude.ai" button for those.

## Smooth motion
The island grows and shrinks with an eased animation (about 0.2 s), with content fading in; honours the system 'reduce motion' setting for CSS effects.

## Activity monitor (📈)
Live CPU, memory, network speed and battery with a CPU history graph. It only samples (every 1.5 s) while the tab is open, so idle cost is zero.

## Position
The island sits at top-center, directly under the camera. On notched MacBooks it starts just below the notch; on other Macs it sits over the menu bar (above it, on every Space and over full-screen apps). On Windows it sits at the top of the screen.

## Motion
The island resizes with a native, GPU-driven animation (macOS NSAnimationContext; Windows SetWindowPos at ~120 fps), hover-intent delay avoids accidental opening, and panels fade out before shrinking.
