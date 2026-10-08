# MadScope architecture

## Principles

- Local-first: no backend, no telemetry, render server binds to 127.0.0.1.
- Core is UI-agnostic: `packages/core` exposes `scanUrl`, `createBaseline`, `runRegressionTest`. Desktop UI, CLI, and (future) CI import it.
- Browser reuse: `BrowserEngine` keeps one Chromium process; each viewport gets a fresh `BrowserContext` (correct viewport/isMobile/hasTouch isolation) which is closed after use. No orphaned processes: `closeEngine()` on shutdown.

## Data flow (scan)

1. UI/CLI validates URL (`@madscope/shared`) and resolves viewports.
2. `scanUrl` loads config, then sequentially renders each viewport via `BrowserEngine.renderViewport`.
3. In-page `collectLayout` (serialized evaluate) returns overflow/images/touch/overlap/offscreen/clipped signals.
4. Screenshots saved via `@madscope/screenshots` (+ `history.json`).
5. `detectIssues` + `scoreIssues` produce findings and the 0–100 health score.

## Why Express sidecar instead of Tauri commands for rendering

Playwright is Node-only. The desktop app therefore runs a tiny local Express server (`apps/desktop/server`) that imports `@madscope/core` directly. In Tauri production this server runs as a sidecar and the WebView talks to it over `http://127.0.0.1:4220`. This keeps one engine for desktop, CLI, and CI.

## Tech deviations

- Package manager: npm workspaces (pnpm unavailable on this machine).
- Tauri bundle requires Rust; the repo ships a valid `src-tauri/` scaffold and the Vite UI, verified via `vite build`. `tauri dev/build` needs a Rust toolchain.
