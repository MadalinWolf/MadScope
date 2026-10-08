import cors from "cors";
import express from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  validateUrl,
  VIEWPORT_PRESETS,
  type ViewportConfig,
} from "@madscope/shared";
import { loadConfig, mergeConfig } from "@madscope/config";
import { scanUrl, createBaseline, runRegressionTest } from "@madscope/core";
import { listHistory } from "@madscope/screenshots";
import { comparePngBuffers } from "@madscope/visual-diff";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = Number(process.env.MADSCOPE_PORT ?? 4220);

function toViewport(input: {
  id?: string;
  name?: string;
  width: number;
  height: number;
}): ViewportConfig {
  const w = Number(input.width);
  const h = Number(input.height);
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 200 ||
    w > 7680 ||
    h < 200 ||
    h > 4320
  ) {
    throw new Error(
      `Invalid viewport dimensions ${input.width}x${input.height}.`,
    );
  }
  return {
    id: input.id ?? `custom-${w}x${h}`,
    name: input.name ?? `Custom ${w}×${h}`,
    width: w,
    height: h,
    deviceScaleFactor: 1,
    isMobile: w < 768,
    hasTouch: w < 768,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "MadScope", version: "0.1.0" });
});

app.get("/api/presets", (_req, res) => {
  res.json({ presets: VIEWPORT_PRESETS });
});

app.post("/api/scan", async (req, res) => {
  const { url, viewports, fullPage } = req.body as {
    url: string;
    viewports: Array<{
      id?: string;
      width: number;
      height: number;
      name?: string;
    }>;
    fullPage?: boolean;
  };
  const v = validateUrl(String(url ?? ""));
  if (!v.ok) {
    res.status(400).json({ error: v.error });
    return;
  }
  try {
    const base = await loadConfig(process.cwd());
    const config = mergeConfig(
      base,
      fullPage !== undefined
        ? { screenshot: { ...base.screenshot, fullPage: !!fullPage } }
        : {},
    );
    const vps: ViewportConfig[] = (viewports ?? []).map((x) => {
      if (x.id) {
        const p = VIEWPORT_PRESETS.find((pr) => pr.id === x.id);
        if (p) {
          const { category: _c, ...rest } = p;
          return rest;
        }
      }
      return toViewport(x);
    });
    if (vps.length === 0) {
      res.status(400).json({ error: "Select at least one viewport." });
      return;
    }
    const scan = await scanUrl(v.url, vps, config, { includeBase64: true });
    res.json(scan);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/baseline", async (req, res) => {
  const { url, viewports } = req.body as {
    url: string;
    viewports: Array<{
      id?: string;
      width: number;
      height: number;
      name?: string;
    }>;
  };
  const v = validateUrl(String(url ?? ""));
  if (!v.ok) {
    res.status(400).json({ error: v.error });
    return;
  }
  try {
    const base = await loadConfig(process.cwd());
    const config = mergeConfig(base, {});
    const vps: ViewportConfig[] = (viewports ?? []).map((x) => {
      if (x.id) {
        const p = VIEWPORT_PRESETS.find((pr) => pr.id === x.id);
        if (p) {
          const { category: _c, ...rest } = p;
          return rest;
        }
      }
      return toViewport(x);
    });
    const entries = await createBaseline(v.url, vps, config);
    res.json({ entries });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/test", async (req, res) => {
  const { url, viewports } = req.body as {
    url: string;
    viewports: Array<{
      id?: string;
      width: number;
      height: number;
      name?: string;
    }>;
  };
  const v = validateUrl(String(url ?? ""));
  if (!v.ok) {
    res.status(400).json({ error: v.error });
    return;
  }
  try {
    const base = await loadConfig(process.cwd());
    const config = mergeConfig(base, {});
    const vps: ViewportConfig[] = (viewports ?? []).map((x) => {
      if (x.id) {
        const p = VIEWPORT_PRESETS.find((pr) => pr.id === x.id);
        if (p) {
          const { category: _c, ...rest } = p;
          return rest;
        }
      }
      return toViewport(x);
    });
    const report = await runRegressionTest(v.url, vps, config);
    // Attach base64 for UI preview (actual + diff)
    const withImages = report.cases.map((c) => {
      let actualBase64: string | undefined;
      let diffBase64: string | undefined;
      try {
        if (c.actualFile)
          actualBase64 = readFileSync(c.actualFile).toString("base64");
        if (c.diffFile)
          diffBase64 = readFileSync(c.diffFile).toString("base64");
      } catch {
        // ignore
      }
      return { ...c, actualBase64, diffBase64 };
    });
    res.json({ ...report, cases: withImages });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/history", async (_req, res) => {
  try {
    const base = await loadConfig(process.cwd());
    const dir = resolve(process.cwd(), base.outDir);
    res.json({ items: listHistory(dir) });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/diff", async (req, res) => {
  const { aPath, bPath, threshold } = req.body as {
    aPath: string;
    bPath: string;
    threshold?: number;
  };
  try {
    const a = readFileSync(aPath);
    const b = readFileSync(bPath);
    const diff = comparePngBuffers(a, b, threshold ?? 0.005);
    res.json({
      ...diff,
      diffPng: undefined,
      diffBase64: diff.diffPng.toString("base64"),
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`MadScope render server listening on http://127.0.0.1:${PORT}`);
});
