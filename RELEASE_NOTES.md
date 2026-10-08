# MadScope v1.0.0

First distributable release of **MadScope** — the local-first responsive website testing and visual regression tool. Free and open source ([MIT](https://github.com/MadalinWolf/MadScope/blob/master/LICENSE)).

## What it does

Enter a URL, pick viewports, and MadScope renders the page in real Chromium, captures screenshots, flags potential responsive issues, computes a deterministic 0–100 health score, and diffs renders against saved baselines — with a desktop UI and a CI-ready CLI.

## Install

### Windows (x64)

- `MadScope-1.0.0-windows-x64.msi` — installer package
- `MadScope-1.0.0-windows-x64-setup.exe` — setup wizard (NSIS)

### macOS

- `MadScope-1.0.0-macos-arm64.dmg` — Apple Silicon (M1/M2/M3/M4)
- `MadScope-1.0.0-macos-x64.dmg` — Intel

> These builds are **unsigned**. On first launch, macOS Gatekeeper will block the app: right-click (or Control-click) the app → **Open** → **Open** to run it. Signing/notarization will follow once an Apple Developer identity is available.

### Linux (x64)

- `MadScope-1.0.0-linux-x64.AppImage` — portable: `chmod +x` and run
- `MadScope-1.0.0-linux-x64.deb` — Debian/Ubuntu package

## First launch

The desktop app ships its full engine (Chromium included, ~380MB unpacked) — no extra downloads, no account, everything stays on your machine. Screenshots and baselines are stored in the app data directory.

## Verify downloads

Compare against `CHECKSUMS.txt` (SHA-256) attached to this release:

```bash
sha256sum -c CHECKSUMS.txt
```

## Known limitations (v1.0.0)

- macOS builds are unsigned (see Gatekeeper note above).
- Engine bundles Chromium headless shell only; headed debugging is not included.
- Rendering is sequential per viewport in this release; parallel rendering is on the roadmap.

## Source

Built from the [`v1.0.0` tag](https://github.com/MadalinWolf/MadScope/tree/v1.0.0). To build from source: `npm install`, `npx playwright install chromium`, `npm test`, `npm run build`.
