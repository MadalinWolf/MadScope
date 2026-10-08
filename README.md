# MadScope

> MadScope is a local-first developer tool for responsive testing, screenshot comparison, and visual regression testing.

**Status:** MVP 0.1.0 — functional local-first core, CLI, desktop UI (Vite + Tauri scaffold), visual regression, and automated tests.

**Privacy:** No account. No telemetry. No analytics. No cloud storage. No screenshot uploads. Everything runs on your machine unless you explicitly export something.

## Features (what actually works in 0.1.0)

- Enter a URL (including `http://localhost:*`) and render it with real Chromium (Playwright) at multiple viewport sizes
- Viewport presets (Mobile Small → Large Desktop) + custom dimensions
- Viewport screenshots (PNG/JPEG, full-page optional), saved locally with metadata + history
- Responsive issue detection: horizontal overflow, element overflow, text clipping, image overflow, small touch targets, overlapping elements, off-screen elements — all labeled "Potential issue"
- Deterministic Responsive Health score (0–100, documented in `docs/scoring.md`)
- Breakpoint ruler
- Screenshot comparison: side-by-side, overlay with opacity, before/after slider, deterministic diff image (pixelmatch)
- Baselines + visual regression (`madscope baseline` / `madscope test`) with configurable threshold and non-zero exit code on failure
- Type-safe config (`madscope.config.ts`), CLI (`madscope`), desktop UI, local render server
- Unit + integration tests with deterministic local fixtures (no third-party sites required)

Experimental / planned (not yet implemented): Firefox/WebKit engines, network throttling, Lighthouse, auth storage-state UI, GitHub Action PR comments, cloud sync. The architecture allows these without breaking the core.

## Installation

Requirements: Node.js ≥ 18.18, npm. For the Tauri bundle: Rust stable + OS WebView deps.

```bash
git clone <your-fork-url>
cd MadScope
npm install
npx playwright install chromium
```

## Development

```bash
npm install
npm run dev:server      # start render server on http://127.0.0.1:4220 (apps/desktop)
npm run dev             # start desktop UI on http://localhost:1420 (proxies /api)
npm run build           # build all packages + apps
npm test                # unit tests (vitest)
npm run test:integration  # browser integration tests (needs Chromium)
```

Every documented command works. `npm run lint` / `npm run format` / `npm run typecheck` are configured and pass.

### Desktop (Tauri)

The UI in `apps/desktop/src` runs in Vite during development. The Tauri shell in `apps/desktop/src-tauri` wraps the same `dist/` output:

```bash
cd apps/desktop
npx tauri dev     # needs Rust toolchain
npx tauri build   # needs Rust toolchain
```

Note: this environment ships without Rust, so `tauri dev/build` is documented but not part of automated verification here. The web UI + render server path is fully verified and is what Tauri loads via `devUrl`/`frontendDist`.

## CLI usage

```bash
node apps/cli/dist/index.js screenshot https://example.com --viewport mobile tablet desktop
node apps/cli/dist/index.js baseline https://example.com
node apps/cli/dist/index.js test https://example.com
node apps/cli/dist/index.js config --init
```

After `npm run build`, link locally: `npm link -w @madscope/cli` then use `madscope …`. Options: `--width/--height`, `--device mobile`, `--full-page`, `--output`, `--threshold`.

CI-friendly: `madscope test` exits 1 when a diff exceeds the threshold or a baseline is missing, and writes `actual-*`/`diff-*` images to `.madscope/results/`.

## Configuration

Create `madscope.config.ts` in your project root:

```ts
import { defineConfig } from "@madscope/config";
export default defineConfig({
  urls: ["https://example.com"],
  viewports: [
    {
      id: "mobile",
      name: "Mobile",
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    },
    { id: "desktop", name: "Desktop", width: 1440, height: 900 },
  ],
  diffThreshold: 0.005,
});
```

See `docs/configuration.md` for all fields (screenshot type, wait time, locale, timezone, color scheme, reduced motion, dirs).

## Visual regression

```bash
madscope baseline https://example.com
madscope test https://example.com
# ✓ Mobile 390×844
# ✗ Desktop 1440×900 — Visual difference detected (2.84% > 0.50%)
```

## Architecture

```
apps/desktop  React UI + local render server (Express) + Tauri shell
apps/cli      commander CLI (same @madscope/core engine)
packages/core         scan/baseline/test orchestration (UI-agnostic)
packages/browser      Playwright engine (shared browser process, per-viewport contexts)
packages/screenshots  local storage + history
packages/visual-diff  deterministic pixelmatch diff
packages/issue-detector issues + health score
packages/config       type-safe config
packages/shared       viewport model + URL validation
```

See `docs/architecture.md`.

## Privacy

Local-first by design: renders and screenshots never leave your disk. No telemetry code exists in this repo. Render server binds to `127.0.0.1` only.

## Contributing / Roadmap / License

See `CONTRIBUTING.md`, `docs/roadmap.md`, `LICENSE` (MIT).
