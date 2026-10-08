import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import type { ViewportConfig } from "@madscope/shared";

export type ScreenshotMetadata = {
  id: string;
  url: string;
  viewportId: string;
  viewportName: string;
  width: number;
  height: number;
  timestamp: string;
  screenshotPath: string;
  fullPage: boolean;
  title?: string;
};

export function slugifyUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-");
    const path = u.pathname
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    return `${host}${path ? `-${path}` : ""}`.slice(0, 80) || "page";
  } catch {
    return url.replace(/[^a-z0-9]+/gi, "-").slice(0, 80) || "page";
  }
}

export function buildScreenshotFilename(
  url: string,
  viewport: ViewportConfig,
  ext = "png",
): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${slugifyUrl(url)}-${viewport.id}-${viewport.width}x${viewport.height}-${ts}.${ext}`;
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function saveScreenshot(params: {
  buffer: Buffer;
  url: string;
  viewport: ViewportConfig;
  outDir: string;
  fullPage?: boolean;
  title?: string;
  ext?: string;
}): ScreenshotMetadata {
  const { buffer, url, viewport, outDir } = params;
  ensureDir(outDir);
  const filename = buildScreenshotFilename(url, viewport, params.ext ?? "png");
  const full = resolve(outDir, filename);
  writeFileSync(full, buffer);
  const meta: ScreenshotMetadata = {
    id: filename.replace(/\.[^.]+$/, ""),
    url,
    viewportId: viewport.id,
    viewportName: viewport.name,
    width: viewport.width,
    height: viewport.height,
    timestamp: new Date().toISOString(),
    screenshotPath: full,
    fullPage: params.fullPage ?? false,
    title: params.title,
  };
  writeFileSync(
    resolve(outDir, `${meta.id}.json`),
    JSON.stringify(meta, null, 2),
    "utf-8",
  );
  appendToHistory(outDir, meta);
  return meta;
}

function historyFile(outDir: string): string {
  return resolve(outDir, "history.json");
}

function appendToHistory(outDir: string, meta: ScreenshotMetadata): void {
  const file = historyFile(outDir);
  let list: ScreenshotMetadata[] = [];
  if (existsSync(file)) {
    try {
      list = JSON.parse(readFileSync(file, "utf-8")) as ScreenshotMetadata[];
    } catch {
      list = [];
    }
  }
  list.unshift(meta);
  writeFileSync(file, JSON.stringify(list.slice(0, 500), null, 2), "utf-8");
}

export function listHistory(outDir: string): ScreenshotMetadata[] {
  const file = historyFile(outDir);
  if (!existsSync(file)) {
    // Fall back to scanning sidecar json files
    if (!existsSync(outDir)) return [];
    const entries = readdirSync(outDir).filter(
      (f) => f.endsWith(".json") && f !== "history.json",
    );
    const metas: ScreenshotMetadata[] = [];
    for (const e of entries) {
      try {
        metas.push(
          JSON.parse(
            readFileSync(join(outDir, e), "utf-8"),
          ) as ScreenshotMetadata,
        );
      } catch {
        // skip corrupt sidecar
      }
    }
    return metas.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }
  try {
    const list = JSON.parse(
      readFileSync(file, "utf-8"),
    ) as ScreenshotMetadata[];
    return list.filter(
      (m) =>
        existsSync(m.screenshotPath) ||
        existsSync(resolve(outDir, basename(m.screenshotPath))),
    );
  } catch {
    return [];
  }
}
