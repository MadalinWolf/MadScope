import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BrowserEngine, type RenderResult } from "@madscope/browser";
import { resolveDirs, type MadScopeConfig } from "@madscope/config";
import {
  detectIssues,
  scoreIssues,
  type HealthScore,
  type ResponsiveIssue,
} from "@madscope/issue-detector";
import { saveScreenshot, type ScreenshotMetadata } from "@madscope/screenshots";
import { comparePngBuffers, type DiffResult } from "@madscope/visual-diff";
import type { ViewportConfig } from "@madscope/shared";

export type ViewportRunResult = {
  viewport: ViewportConfig;
  title: string;
  loadTimeMs: number;
  screenshot: ScreenshotMetadata;
  screenshotBase64?: string;
  issues: ResponsiveIssue[];
};

export type ScanResult = {
  url: string;
  results: ViewportRunResult[];
  health: HealthScore;
};

export type BaselineEntry = {
  url: string;
  viewportId: string;
  width: number;
  height: number;
  file: string;
  timestamp: string;
};

export type TestCaseResult = {
  viewport: ViewportConfig;
  status: "pass" | "fail" | "no-baseline" | "error";
  changeRatio?: number;
  changedPixels?: number;
  threshold: number;
  baselineFile?: string;
  actualFile?: string;
  diffFile?: string;
  message: string;
};

export type RegressionTestReport = {
  url: string;
  cases: TestCaseResult[];
  passed: boolean;
};

let sharedEngine: BrowserEngine | null = null;

export function getEngine(): BrowserEngine {
  if (!sharedEngine) sharedEngine = new BrowserEngine();
  return sharedEngine;
}

export async function closeEngine(): Promise<void> {
  if (sharedEngine) {
    await sharedEngine.close();
    sharedEngine = null;
  }
}

export async function scanUrl(
  url: string,
  viewports: ViewportConfig[],
  config: MadScopeConfig,
  opts?: {
    cwd?: string;
    includeBase64?: boolean;
    onViewport?: (r: ViewportRunResult) => void;
  },
): Promise<ScanResult> {
  const cwd = opts?.cwd ?? process.cwd();
  const dirs = resolveDirs(config, cwd);
  mkdirSync(dirs.outDir, { recursive: true });
  const engine = getEngine();
  const results: ViewportRunResult[] = [];
  // Sequential for stability; architecture allows parallel later.
  for (const viewport of viewports) {
    const render: RenderResult = await engine.renderViewport(
      url,
      viewport,
      config,
    );
    const meta = saveScreenshot({
      buffer: render.screenshot,
      url,
      viewport,
      outDir: dirs.outDir,
      fullPage: config.screenshot.fullPage,
      title: render.title,
      ext: config.screenshot.type === "jpeg" ? "jpg" : "png",
    });
    const issues = detectIssues(render.layout, viewport);
    const item: ViewportRunResult = {
      viewport,
      title: render.title,
      loadTimeMs: render.loadTimeMs,
      screenshot: meta,
      issues,
    };
    if (opts?.includeBase64) {
      item.screenshotBase64 = render.screenshot.toString("base64");
    }
    results.push(item);
    opts?.onViewport?.(item);
  }
  const health = scoreIssues(results.map((r) => r.issues));
  return { url, results, health };
}

function baselineKey(url: string, viewport: ViewportConfig): string {
  let slug = "page";
  try {
    const u = new URL(url);
    slug =
      `${u.hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-")}${u.pathname.replace(/[^a-z0-9]+/gi, "-")}`.slice(
        0,
        60,
      ) || "page";
  } catch {
    slug = url.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
  }
  return `${slug}-${viewport.id}-${viewport.width}x${viewport.height}.png`;
}

export async function createBaseline(
  url: string,
  viewports: ViewportConfig[],
  config: MadScopeConfig,
  cwd = process.cwd(),
): Promise<BaselineEntry[]> {
  const dirs = resolveDirs(config, cwd);
  mkdirSync(dirs.baselineDir, { recursive: true });
  const engine = getEngine();
  const entries: BaselineEntry[] = [];
  for (const viewport of viewports) {
    const render = await engine.renderViewport(url, viewport, config);
    const file = baselineKey(url, viewport);
    const full = resolve(dirs.baselineDir, file);
    writeFileSync(full, render.screenshot);
    entries.push({
      url,
      viewportId: viewport.id,
      width: viewport.width,
      height: viewport.height,
      file: full,
      timestamp: new Date().toISOString(),
    });
  }
  writeFileSync(
    join(dirs.baselineDir, "manifest.json"),
    JSON.stringify(entries, null, 2),
    "utf-8",
  );
  return entries;
}

export function readBaselineManifest(baselineDir: string): BaselineEntry[] {
  const manifest = join(baselineDir, "manifest.json");
  if (!existsSync(manifest)) return [];
  try {
    return JSON.parse(readFileSync(manifest, "utf-8")) as BaselineEntry[];
  } catch {
    throw new Error(
      `MadScope found a corrupted baseline manifest at ${manifest}. Delete .madscope/baselines and re-create the baseline.`,
    );
  }
}

export async function runRegressionTest(
  url: string,
  viewports: ViewportConfig[],
  config: MadScopeConfig,
  cwd = process.cwd(),
): Promise<RegressionTestReport> {
  const dirs = resolveDirs(config, cwd);
  mkdirSync(dirs.resultsDir, { recursive: true });
  const manifest = readBaselineManifest(dirs.baselineDir);
  const engine = getEngine();
  const cases: TestCaseResult[] = [];
  for (const viewport of viewports) {
    const expected = manifest.find(
      (m) =>
        m.viewportId === viewport.id &&
        m.width === viewport.width &&
        m.height === viewport.height,
    );
    if (!expected || !existsSync(expected.file)) {
      cases.push({
        viewport,
        status: "no-baseline",
        threshold: config.diffThreshold,
        message: `No baseline found for ${viewport.name}. Run "madscope baseline" first.`,
      });
      continue;
    }
    let render: RenderResult;
    try {
      render = await engine.renderViewport(url, viewport, config);
    } catch (err) {
      cases.push({
        viewport,
        status: "error",
        threshold: config.diffThreshold,
        message: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    const baselineBuf = readFileSync(expected.file);
    let diff: DiffResult;
    try {
      diff = comparePngBuffers(
        baselineBuf,
        render.screenshot,
        config.diffThreshold,
      );
    } catch (err) {
      cases.push({
        viewport,
        status: "error",
        threshold: config.diffThreshold,
        message: `Could not compare screenshots: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    const actualFile = resolve(
      dirs.resultsDir,
      `actual-${baselineKey(url, viewport)}`,
    );
    const diffFile = resolve(
      dirs.resultsDir,
      `diff-${baselineKey(url, viewport)}`,
    );
    writeFileSync(actualFile, render.screenshot);
    writeFileSync(diffFile, diff.diffPng);
    if (diff.passed) {
      cases.push({
        viewport,
        status: "pass",
        changeRatio: diff.changeRatio,
        changedPixels: diff.changedPixels,
        threshold: config.diffThreshold,
        baselineFile: expected.file,
        actualFile,
        diffFile,
        message: `No significant visual change (${(diff.changeRatio * 100).toFixed(2)}% <= ${(config.diffThreshold * 100).toFixed(2)}%).`,
      });
    } else {
      cases.push({
        viewport,
        status: "fail",
        changeRatio: diff.changeRatio,
        changedPixels: diff.changedPixels,
        threshold: config.diffThreshold,
        baselineFile: expected.file,
        actualFile,
        diffFile,
        message: `Visual difference detected (${(diff.changeRatio * 100).toFixed(2)}% > ${(config.diffThreshold * 100).toFixed(2)}%).`,
      });
    }
  }
  return {
    url,
    cases,
    passed: cases.length > 0 && cases.every((c) => c.status === "pass"),
  };
}
