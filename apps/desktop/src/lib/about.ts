/**
 * Static metadata for the "About MadScope" panel in the desktop UI.
 *
 * Every value is real and sourced from the repository itself:
 * - `version` mirrors apps/desktop/package.json (and the Tauri bundle version,
 *   which is what the installed app reports); tests/unit/about.test.ts fails
 *   if it ever drifts — the same sync convention versions.test.ts enforces
 *   across the other manifests.
 * - `license` mirrors the repository LICENSE file (checked by the same test).
 * - `websiteUrl` / `repositoryUrl` are the project's canonical destinations
 *   (the repo's Tauri identifier is com.madwolfstudios.madscope and the
 *   project page lives on madwolfstudios.com).
 * - `acknowledgments` lists tools actually used by the stack.
 * Nothing here is invented.
 */
export const ABOUT = {
  name: "MadScope",
  description:
    "Local-first responsive website testing and visual regression for developers — real Chromium renders across viewports, screenshots, potential-issue detection, a deterministic health score and baseline comparison, all on your machine with no account and no telemetry.",
  studio: "Madwolf Studios",
  websiteUrl: "https://madwolfstudios.com/",
  repositoryUrl: "https://github.com/MadalinWolf/MadScope",
  license: "MIT",
  licenseUrl: "https://github.com/MadalinWolf/MadScope/blob/master/LICENSE",
  version: "1.1.0",
  acknowledgments:
    "Built with Playwright and Chromium for real browser rendering, plus React, Vite, Tauri and Tailwind CSS.",
} as const;
