# Verification — v1.1.0

What was run for the v1.1.0 feature update (three themes + selectable/copyable
diagnostics + AI-ready report), what passed, and what was not tested. Results
below are from the actual runs, not aspirations.

Feature commit: [`291f009`](https://github.com/MadalinWolf/MadScope/commit/291f00951a42b2aff72c3892e9802e9d2e3f9779)
CI run: [#37984646506](https://github.com/MadalinWolf/MadScope/actions/runs/37984646506)

## Automated checks (local, Windows, Node 24)

| Check              | Command             | Result                                                               |
| ------------------ | ------------------- | -------------------------------------------------------------------- |
| Formatting         | `npm run format`    | ✅ pass (prettier)                                                   |
| Lint               | `npm run lint`      | ✅ pass (eslint)                                                     |
| Typecheck          | `npm run typecheck` | ✅ pass (tsc project references)                                     |
| Production build   | `npm run build`     | ✅ pass (Vite desktop bundle, all 3 theme blocks present in `dist/`) |
| Unit + integration | `npm test`          | ✅ **57/57 passed** (11 files; 53 unit + 4 integration)              |

New unit tests added for this release:

- `tests/unit/report.test.ts` — report header/URL/viewport/profile/timestamp/
  health/source lines, per-entry `[n] Type:/Severity:/Message:/Viewport:` with
  `Selector`/`Evidence` only when known, summary count equals entry count,
  zero-diagnostic report, no invented fields.
- `tests/unit/themes.test.ts` — exactly three theme ids and labels, load/save
  round-trip, invalid stored value falls back to `existing`, `applyTheme`
  sets/removes `data-theme` on `<html>`.
- `tests/unit/clipboard.test.ts` — async Clipboard API success, hidden-textarea
  `execCommand` fallback when the async API is unavailable, honest failure
  result when both paths fail.

CI (`.github/workflows/ci.yml`) now runs `typecheck → lint → test → build` on
every push — the build step is the only addition, no new workflows.

## Live browser validation (real browser, real URL)

Validated in Chromium against the dev build with the canonical MadScope page
`https://madwolfstudios.com/projects/madscope/`:

- **Theme switching** — selector shows exactly 3 options; Existing is default;
  Terminal applies `data-theme="terminal"` (app bg `rgb(8,12,8)`, terminal-green
  accent `rgb(63,241,95)`, monospaced technical elements); Light applies
  `data-theme="light"` (`rgb(243,244,246)` surfaces, `color-scheme: light`,
  restrained panel shadow). Instant, no reload.
- **Persistence** — after selecting Terminal and reloading the page, the theme
  is still Terminal (`data-theme` set before first paint by the bootstrap
  script — no flash of the default theme).
- **Real inspection** — mobile viewport (390×844) scan of the live URL
  returned a health score of **84/100** with **12 genuine engine diagnostics**
  (1× element-overflow skip-link [medium], 10× small-touch-target [low],
  1× offscreen-element [low]). These are the engine's real output for that
  page at that viewport — nothing hardcoded.
- **Copy paths** — each verified by intercepting the clipboard write and
  asserting the exact text:
  - Copy (per finding) → full single entry (type/severity/message/viewport/
    selector/evidence), row + status feedback.
  - Copy selected (2 ticked) → exactly those 2 entries, renumbered.
  - Copy all errors → all 12 entries, numbered in report order, no truncation.
  - Copy AI report → `MADSCOPE WEBSITE INSPECTION REPORT` with real
    URL/viewport `390 × 844`/profile `mobile`/timestamp/health `84 / 100`/
    `Diagnostics source:` line, `Total reported diagnostics: 12` matching the
    12 entries, `END OF REPORT`.
- **Page health during validation** — 0 console errors, 0 failed network
  requests, no horizontal overflow, diagnostics text selectable
  (`user-select: auto`), keyboard shortcuts ignored while the theme `select`
  is focused.

## Screenshots

Genuine captures of the running app inspecting the live URL (Playwright,
project's own stack), 1440×900, stored in `docs/images/`:

| File                              | Shows                                           |
| --------------------------------- | ----------------------------------------------- |
| `madscope-existing-theme.png`     | Existing theme (default)                        |
| `madscope-terminal-theme.png`     | Terminal theme                                  |
| `madscope-light-theme.png`        | Light theme                                     |
| `madscope-mobile-diagnostics.png` | Mobile inspection results with real diagnostics |
| `madscope-copy-report.png`        | Copy controls + AI-report status feedback       |

## Not tested / known limits

- **Firefox and WebKit engines** — MadScope's engine is Chromium-based; the
  themes use standard CSS custom properties and Tailwind utilities only, but
  only Chromium rendering was exercised.
- **Other URLs** — live validation used the canonical MadScope project page;
  other sites will of course report different (or zero) diagnostics. The
  zero-diagnostic copy behavior is covered by unit tests instead.
- **Tauri packaging** — the UI changes were validated in the browser build;
  `npm run build` (the same `dist/` the Tauri shell wraps) passes, but a
  packaged `.msi` from this commit was not produced locally. Installers are
  built by `release.yml` from the version tag.
- **Clipboard permission edge cases** — success and both fallback paths are
  unit-tested with mocks; end-to-end copy was verified in a real browser where
  the Clipboard API is available.
