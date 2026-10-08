import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  VIEWPORT_PRESETS,
  validateViewport,
  type ViewportConfig,
} from "@madscope/shared";

export type ScreenshotSettings = {
  type: "png" | "jpeg";
  quality?: number;
  fullPage: boolean;
  animations: "disabled" | "allow";
  colorScheme: "light" | "dark" | "no-preference";
  reducedMotion: "reduce" | "no-preference";
  locale: string;
  timezone?: string;
};

export type MadScopeConfig = {
  urls: string[];
  viewports: ViewportConfig[];
  screenshot: ScreenshotSettings;
  diffThreshold: number;
  waitTime: number;
  navigationTimeout: number;
  outDir: string;
  baselineDir: string;
  resultsDir: string;
};

export const DEFAULT_CONFIG: MadScopeConfig = {
  urls: [],
  viewports: VIEWPORT_PRESETS.filter((p) =>
    ["mobile", "tablet", "desktop"].includes(p.id),
  ).map(({ category: _category, ...rest }) => rest),
  screenshot: {
    type: "png",
    fullPage: false,
    animations: "disabled",
    colorScheme: "no-preference",
    reducedMotion: "reduce",
    locale: "en-US",
  },
  diffThreshold: 0.005,
  waitTime: 500,
  navigationTimeout: 30000,
  outDir: ".madscope/screenshots",
  baselineDir: ".madscope/baselines",
  resultsDir: ".madscope/results",
};

export function defineConfig(partial: Partial<MadScopeConfig>): MadScopeConfig {
  return mergeConfig(DEFAULT_CONFIG, partial);
}

export function mergeConfig(
  base: MadScopeConfig,
  partial: Partial<MadScopeConfig>,
): MadScopeConfig {
  const merged: MadScopeConfig = {
    ...base,
    ...partial,
    screenshot: { ...base.screenshot, ...(partial.screenshot ?? {}) },
    viewports: partial.viewports ?? base.viewports,
    urls: partial.urls ?? base.urls,
  };
  const errors = validateConfig(merged);
  if (errors.length > 0) {
    throw new Error(`Invalid MadScope config: ${errors.join(" ")}`);
  }
  return merged;
}

export function validateConfig(config: MadScopeConfig): string[] {
  const errors: string[] = [];
  if (!Array.isArray(config.viewports) || config.viewports.length === 0) {
    errors.push("config.viewports must be a non-empty array.");
  } else {
    for (const v of config.viewports) {
      const ve = validateViewport(v);
      for (const e of ve)
        errors.push(
          `viewport "${(v as ViewportConfig).name ?? (v as ViewportConfig).id}": ${e}`,
        );
    }
  }
  if (
    typeof config.diffThreshold !== "number" ||
    config.diffThreshold < 0 ||
    config.diffThreshold > 1
  ) {
    errors.push("config.diffThreshold must be a number between 0 and 1.");
  }
  if (
    !Number.isInteger(config.waitTime) ||
    config.waitTime < 0 ||
    config.waitTime > 30000
  ) {
    errors.push("config.waitTime must be an integer between 0 and 30000 ms.");
  }
  if (
    !Number.isInteger(config.navigationTimeout) ||
    config.navigationTimeout < 1000 ||
    config.navigationTimeout > 120000
  ) {
    errors.push(
      "config.navigationTimeout must be an integer between 1000 and 120000 ms.",
    );
  }
  if (!["png", "jpeg"].includes(config.screenshot.type)) {
    errors.push('config.screenshot.type must be "png" or "jpeg".');
  }
  if (!config.outDir || !config.baselineDir || !config.resultsDir) {
    errors.push(
      "config.outDir, baselineDir and resultsDir must be non-empty strings.",
    );
  }
  return errors;
}

const CONFIG_FILE_NAMES = [
  "madscope.config.ts",
  "madscope.config.js",
  "madscope.config.mjs",
  "madscope.config.json",
];

export async function loadConfig(cwd = process.cwd()): Promise<MadScopeConfig> {
  for (const name of CONFIG_FILE_NAMES) {
    const full = resolve(cwd, name);
    if (existsSync(full)) {
      if (name.endsWith(".json")) {
        const raw = readFileSync(full, "utf-8");
        const parsed = JSON.parse(raw) as Partial<MadScopeConfig>;
        return mergeConfig(DEFAULT_CONFIG, parsed);
      }
      const mod = (await import(`file://${full}`)) as {
        default?: Partial<MadScopeConfig>;
      } & Partial<MadScopeConfig>;
      const partial = (mod.default ?? mod) as Partial<MadScopeConfig>;
      return mergeConfig(DEFAULT_CONFIG, partial);
    }
  }
  return { ...DEFAULT_CONFIG };
}

export function initConfigFile(cwd = process.cwd()): string {
  const full = resolve(cwd, "madscope.config.ts");
  if (existsSync(full)) {
    throw new Error(`madscope.config.ts already exists at ${full}`);
  }
  const content = `import { defineConfig } from "@madscope/config";

export default defineConfig({
  urls: ["https://example.com"],
  viewports: [
    { id: "mobile", name: "Mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
    { id: "tablet", name: "Tablet", width: 768, height: 1024, isMobile: true, hasTouch: true },
    { id: "desktop", name: "Desktop", width: 1440, height: 900 },
  ],
  diffThreshold: 0.005,
});
`;
  writeFileSync(full, content, "utf-8");
  return full;
}

export function resolveDirs(config: MadScopeConfig, cwd = process.cwd()) {
  return {
    outDir: resolve(cwd, config.outDir),
    baselineDir: resolve(cwd, config.baselineDir),
    resultsDir: resolve(cwd, config.resultsDir),
  };
}
