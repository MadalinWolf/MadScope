# Roadmap

## 0.1.0 (this release)

Core engine, browser, screenshots+history, issue detection+score, ruler, comparison UI, baselines+regression, config, CLI, docs, tests.

## Next

- GitHub Action (`madscope/action`) with artifact upload + threshold fail — action YAML ships in `.github/workflows/` as a consumer example; marketplace publication after validation.
- Auth support (Playwright storageState, cookies, custom headers) with secret redaction.
- Firefox/WebKit engines, device presets, throttling, masking selectors.
- Packaging: Tauri installers for Win/macOS/Linux (needs Rust CI).

Out of scope for MVP: cloud sync, team features, test recording.
