import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startFixtureServer } from "../fixtures/server";
import { BrowserEngine } from "@madscope/browser";
import { DEFAULT_CONFIG } from "@madscope/config";
import {
  scanUrl,
  createBaseline,
  runRegressionTest,
  closeEngine,
} from "@madscope/core";
import { detectIssues } from "@madscope/issue-detector";

const FIXTURES = resolve(__dirname, "../fixtures");
let base = "";
let closeServer: () => Promise<void> = async () => undefined;

beforeAll(async () => {
  const s = await startFixtureServer(FIXTURES);
  base = s.url;
  closeServer = s.close;
}, 30000);

afterAll(async () => {
  await closeEngine();
  await closeServer();
});

describe("browser rendering", () => {
  it("renders clean page at mobile size and captures screenshot", async () => {
    const engine = new BrowserEngine();
    try {
      const render = await engine.renderViewport(
        `${base}/clean-page/`,
        { id: "mobile", name: "Mobile", width: 390, height: 844 },
        DEFAULT_CONFIG,
      );
      expect(render.screenshot.length).toBeGreaterThan(1000);
      // PNG magic bytes
      expect(render.screenshot[0]).toBe(0x89);
      expect(render.layout.scrollWidth).toBeLessThanOrEqual(391);
    } finally {
      await engine.close();
    }
  });

  it("detects overflow on overflow page", async () => {
    const engine = new BrowserEngine();
    try {
      const render = await engine.renderViewport(
        `${base}/overflow-page/`,
        { id: "mobile", name: "Mobile", width: 390, height: 844 },
        DEFAULT_CONFIG,
      );
      const issues = detectIssues(render.layout, {
        id: "mobile",
        name: "Mobile",
        width: 390,
        height: 844,
      });
      expect(
        issues.some(
          (i) =>
            i.type === "horizontal-overflow" || i.type === "element-overflow",
        ),
      ).toBe(true);
    } finally {
      await engine.close();
    }
  });

  it("scanUrl + baseline + test passes, then detects intentional change", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "madscope-"));
    const config = {
      ...DEFAULT_CONFIG,
      outDir: join(cwd, "shots"),
      baselineDir: join(cwd, "base"),
      resultsDir: join(cwd, "res"),
    };
    const viewports = [
      { id: "mobile", name: "Mobile", width: 390, height: 844 },
    ];
    const scan = await scanUrl(`${base}/clean-page/`, viewports, config, {
      cwd,
    });
    expect(scan.results).toHaveLength(1);
    expect(scan.health.score).toBe(100);

    await createBaseline(`${base}/clean-page/`, viewports, config, cwd);
    const pass = await runRegressionTest(
      `${base}/clean-page/`,
      viewports,
      config,
      cwd,
    );
    expect(pass.passed).toBe(true);

    // Intentional change: compare clean baseline against a different page must fail
    const fail = await runRegressionTest(
      `${base}/overflow-page/`,
      viewports,
      config,
      cwd,
    );
    expect(fail.passed).toBe(false);
    expect(fail.cases[0]?.status).toBe("fail");
  });
});
