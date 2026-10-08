import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { startFixtureServer } from "../fixtures/server";
import { DEFAULT_CONFIG } from "@madscope/config";
import { createBaseline, closeEngine } from "@madscope/core";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(root, "apps/cli/dist/index.js");

let base = "";
let closeServer: () => Promise<void> = async () => undefined;

beforeAll(async () => {
  const s = await startFixtureServer(resolve(root, "tests/fixtures"));
  base = s.url;
  closeServer = s.close;
}, 30000);

afterAll(async () => {
  await closeEngine();
  await closeServer();
});

async function runCli(args: string[], cwd: string) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [cli, ...args], {
      cwd,
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { code: 0, stdout };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    if (process.env.MADSCOPE_DEBUG) {
      console.log("CLI STDOUT:", e.stdout);
      console.log("CLI STDERR:", e.stderr);
    }
    return { code: e.code ?? 1, stdout: e.stdout ?? "" };
  }
}

describe("cli --json", () => {
  it("emits machine-readable pass then fail reports", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "madscope-cli-"));
    const config = {
      ...DEFAULT_CONFIG,
      outDir: join(cwd, "shots"),
      baselineDir: join(cwd, "base"),
      resultsDir: join(cwd, "res"),
    };
    // The CLI resolves its config (and therefore its baseline dirs) from the
    // working directory, so point it at the same dirs used above.
    writeFileSync(
      join(cwd, "madscope.config.json"),
      JSON.stringify({
        outDir: config.outDir,
        baselineDir: config.baselineDir,
        resultsDir: config.resultsDir,
      }),
    );
    const viewports = [
      { id: "mobile", name: "Mobile", width: 390, height: 844 },
    ];
    await createBaseline(`${base}/clean-page/`, viewports, config, cwd);

    // Note: two consecutive headless renders of the same page differ by a
    // fraction of a percent (subpixel text rendering), which is exactly what
    // the threshold is for — so the pass leg uses a 2% threshold while the
    // fail leg (a genuinely different page, ~10%+ changed) uses the default.
    const pass = await runCli(
      [
        "test",
        `${base}/clean-page/`,
        "--viewport",
        "mobile",
        "--threshold",
        "0.02",
        "--json",
      ],
      cwd,
    );
    expect(pass.code).toBe(0);
    const passJson = JSON.parse(pass.stdout) as {
      passed: boolean;
      cases: Array<{ status: string; changeRatio: number }>;
    };
    expect(passJson.passed).toBe(true);
    expect(passJson.cases[0]?.status).toBe("pass");
    expect(passJson.cases[0]?.changeRatio).toBeLessThan(0.02);

    const fail = await runCli(
      ["test", `${base}/overflow-page/`, "--viewport", "mobile", "--json"],
      cwd,
    );
    expect(fail.code).toBe(1);
    const failJson = JSON.parse(fail.stdout) as {
      passed: boolean;
      cases: Array<{ status: string; changeRatio: number }>;
    };
    expect(failJson.passed).toBe(false);
    expect(failJson.cases[0]?.status).toBe("fail");
    expect(failJson.cases[0]?.changeRatio).toBeGreaterThan(0.005);
  }, 180000);
});
