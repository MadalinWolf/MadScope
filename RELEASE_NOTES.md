# MadScope v1.0.1

Patch release fixing first-launch engine startup in the desktop installers: the app now probes all bundle layouts when locating its embedded engine, so the render server reliably starts from MSI, EXE, DMG, AppImage and deb installs.

Free and open source ([MIT](https://github.com/MadalinWolf/MadScope/blob/master/LICENSE)).

## Install

### Windows (x64)

- `MadScope-1.0.1-windows-x64.msi` — installer package
- `MadScope-1.0.1-windows-x64-setup.exe` — setup wizard (NSIS)

### macOS

- `MadScope-1.0.1-macos-arm64.dmg` — Apple Silicon (M1/M2/M3/M4)
- `MadScope-1.0.1-macos-x64.dmg` — Intel

> These builds are **unsigned**. On first launch, macOS Gatekeeper will block the app: right-click (or Control-click) the app → **Open** → **Open** to run it. Signing/notarization will follow once an Apple Developer identity is available.

### Linux (x64)

- `MadScope-1.0.1-linux-x64.AppImage` — portable: `chmod +x` and run
- `MadScope-1.0.1-linux-x64.deb` — Debian/Ubuntu package

## First launch

The desktop app ships its full engine (Chromium included) — no extra downloads, no account, everything stays on your machine. Screenshots and baselines are stored in the app data directory. Windows needs the WebView2 runtime (preinstalled on current Windows 10/11).

## Verify downloads

Compare against `CHECKSUMS.txt` (SHA-256) attached to this release:

```bash
sha256sum -c CHECKSUMS.txt
```

## Known limitations (v1.0.1)

- macOS builds are unsigned (see Gatekeeper note above).
- Engine bundles Chromium headless shell only; headed debugging is not included.
- Rendering is sequential per viewport in this release; parallel rendering is on the roadmap.

## Source

Built from the [`v1.0.1` tag](https://github.com/MadalinWolf/MadScope/tree/v1.0.1). To build from source: `npm install`, `npx playwright install chromium`, `npm test`, `npm run build`.
