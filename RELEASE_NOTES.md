# MadScope v1.1.0

Feature release: three selectable themes and diagnostics you can actually share — selectable, copyable, and exportable as an AI-ready inspection report.

Free and open source ([MIT](https://github.com/MadalinWolf/MadScope/blob/master/LICENSE)).

## What's new

### Three themes

A **Theme** selector in the header, exactly three choices, instant switching, persisted across restarts (`localStorage`):

- **Existing** (default) — the original MadScope dark design, unchanged.
- **Terminal** — near-black green-tinted charcoal, terminal-green accents, monospaced type for URLs, dimensions, diagnostics and reports.
- **Light** — bright surfaces, dark readable text, subtle borders, restrained shadows, accessible status colors.

Every color is driven by CSS custom properties, so all UI — navigation, cards, errors, modals, reports — follows the selected theme. A small bootstrap script applies the persisted theme before first paint (no flash of the default theme).

### Shareable diagnostics with an AI-ready report

- Diagnostics in the results are plain, selectable text and every viewport card now lists **all** findings (previously the first 5).
- **Copy** on each finding, **Copy all errors (N)**, **Copy selected (N)** (tick checkboxes), and **Copy AI report**.
- The AI report is structured plain text (`MADSCOPE WEBSITE INSPECTION REPORT`) containing only fields the engine actually knows: inspected URL, viewport, device profile, timestamp, health score, a diagnostics-source line, a summary count that matches the entries, and one entry per finding with type/severity/message/viewport/selector/evidence. Useful at zero diagnostics too.
- Copy feedback reports success only after the clipboard write really succeeded (async Clipboard API with a hidden-textarea fallback) and shows the real failure message otherwise.

Paste the report straight into OpenCode or another AI coding agent to hand it the exact findings to fix.

## Install

### Windows (x64)

- `MadScope-1.1.0-windows-x64.msi` — installer package
- `MadScope-1.1.0-windows-x64-setup.exe` — setup wizard (NSIS)

### macOS

- `MadScope-1.1.0-macos-arm64.dmg` — Apple Silicon (M1/M2/M3/M4)
- `MadScope-1.1.0-macos-x64.dmg` — Intel

> These builds are **unsigned**. On first launch, macOS Gatekeeper will block the app: right-click (or Control-click) the app → **Open** → **Open** to run it. Signing/notarization will follow once an Apple Developer identity is available.

### Linux (x64)

- `MadScope-1.1.0-linux-x64.AppImage` — portable: `chmod +x` and run
- `MadScope-1.1.0-linux-x64.deb` — Debian/Ubuntu package

## First launch

The desktop app ships its full engine (Chromium included) — no extra downloads, no account, everything stays on your machine. Screenshots and baselines are stored in the app data directory. Windows needs the WebView2 runtime (preinstalled on current Windows 10/11).

## Verify downloads

Compare against `CHECKSUMS.txt` (SHA-256) attached to this release:

```bash
sha256sum -c CHECKSUMS.txt
```

## Verification

See [`docs/verification.md`](https://github.com/MadalinWolf/MadScope/blob/master/docs/verification.md) for what was run for this release (lint, typecheck, full test suite, production build, live-browser validation against the canonical MadScope page, and genuine screenshots in `docs/images/`).

## Known limitations (v1.1.0)

- macOS builds are unsigned (see Gatekeeper note above).
- Engine bundles Chromium headless shell only; headed debugging is not included.
- Rendering is sequential per viewport in this release; parallel rendering is on the roadmap.
- Themes were validated in Chromium; Firefox/WebKit engines are on the roadmap.

## Source

Built from the [`v1.1.0` tag](https://github.com/MadalinWolf/MadScope/tree/v1.1.0). To build from source: `npm install`, `npx playwright install chromium`, `npm test`, `npm run build`.
