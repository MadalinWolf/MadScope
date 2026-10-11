# Roadmap

## Unreleased (on master)

Theme polish: the original theme's user-facing label is now **Default** (internal id `existing` unchanged, so saved preferences keep working). New **About MadScope** panel with the real version, MIT license, Madwolf Studios and GitHub links plus acknowledgments.

## 1.1.0

Three selectable themes (Existing, Terminal, Light) with instant switching and persistence, selectable/copyable diagnostics with copy-all, copy-selected and an AI-ready inspection report for sharing findings with a coding agent.

## 1.0.1

Desktop installers (Windows/macOS/Linux, engine bundled), CLI `--json` output, version-sync tests, release automation.

Core engine, browser, screenshots+history, issue detection+score, ruler, comparison UI, baselines+regression, config, CLI, docs, tests.

## Next

- GitHub Marketplace listing for [`MadalinWolf/madscope-action`](https://github.com/MadalinWolf/madscope-action) — the action itself ships and self-tests in its own repo.
- Auth support (Playwright storageState, cookies, custom headers) with secret redaction.
- Firefox/WebKit engines, device presets, throttling, masking selectors.

Out of scope for MVP: cloud sync, team features, test recording.
