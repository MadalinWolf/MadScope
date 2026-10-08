// MadScope Tauri entry point.
// The render engine (Playwright/Chromium) runs in the Node sidecar server
// (apps/desktop/server) so the same @madscope/core engine powers the
// desktop app, CLI, and CI. See docs/architecture.md.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    madscope_lib::run()
}
