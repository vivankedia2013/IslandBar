<div align="center">

# IslandBar

**A dynamic island for your desktop.**
iPhone-style notch and pill, now-playing music, focus timer, weather, volume, Claude chat and a live system monitor, in a tiny, fast app.

[Download](../../releases/latest) · [Report a bug](../../issues)

</div>

## Features
- **Two looks:** *Notch* (attached to the top edge) or *Island* (floating iPhone-style pill). Switch from the tray icon.
- **Music on the island:** whatever you play (browser, Spotify, Apple Music, any app) appears on the collapsed island with an animated equalizer and scrolling title. Expand it to play, pause and skip.
- **Focus timer:** progress-ring Pomodoro with custom focus and break lengths.
- **System volume:** real master volume control.
- **Weather:** auto location or any city, °C/°F, works offline from cache.
- **Claude chat + usage:** chat from the island with your Anthropic API key; see tokens used and rate-limit reset time.
- **Activity monitor:** CPU, memory, network and battery, sampled only while the tab is open.
- **Light on resources:** native Rust + the system webview, about 3 MB installer, no polling while idle beyond a tiny media check.
- **Stays on top:** above full-screen apps and on every desktop (macOS); under the camera on notched MacBooks.

## Requirements
Windows 10 / 11 (64-bit) or macOS Big Sur 11 and newer (Intel and Apple Silicon).

## Install
1. Open the [latest release](../../releases/latest).
2. **Windows:** run `IslandBar_*_x64-setup.exe`. If SmartScreen warns, click *More info* then *Run anyway*.
3. **macOS:** open `IslandBar_*_universal.dmg`, drag IslandBar to Applications, then right-click it and choose *Open* the first time.

Hover over the island to expand it. Press `Esc` to collapse. Use the tray / menu-bar icon to change shape, enable *Launch at login* or quit.

## Notes
- Music from browsers on macOS works on macOS 11 to 15.3. On 15.4 and newer Apple restricts it, so Spotify and Apple Music still work.
- Claude chat needs an [Anthropic API key](https://console.anthropic.com). Signing in with a Google account is only possible on claude.ai (use the *Open claude.ai* link).
- Installers are not code-signed, so first launch shows a security prompt.

## Build from source
Needs Node 18+, Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).
```
npm install
npx tauri icon assets/icon.png
npm run build
```
Or push a tag (`git tag v1.0.0 && git push --tags`) and GitHub Actions builds both installers.

## License
MIT. See [LICENSE](LICENSE).
