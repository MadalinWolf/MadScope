import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

const workflowsDir = resolve(root, ".github/workflows");
const workflows = readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f));

describe("build-sidecar download verification", () => {
  const src = read("apps/desktop/scripts/build-sidecar.mjs");

  it("pins a SHA-256 for every downloadable Node.js archive", () => {
    const assets = src.match(/const NODE_ASSETS = \{[\s\S]*?\};/)?.[0] ?? "";
    const pins = src.match(/const NODE_SHA256 = \{[\s\S]*?\};/)?.[0] ?? "";
    const assetKeys = [
      ...assets.matchAll(/^\x20{2}(?:"([^"]+)"|(\w+)):/gm),
    ].map((m) => m[1] ?? m[2]);
    const pinPairs = [
      ...pins.matchAll(/(?:"([a-z0-9-]+)"|(\w+)):\s*"([0-9a-f]{64})"/g),
    ].map((m) => ({ key: m[1] ?? m[2], hash: m[3] }));
    expect(assetKeys.length).toBeGreaterThanOrEqual(4);
    expect(pinPairs.map((p) => p.key).sort()).toEqual([...assetKeys].sort());
    for (const p of pinPairs) expect(p.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifies the download and fails the build on mismatch", () => {
    expect(src).toContain("sha256File");
    expect(src).toContain("SHA-256 MISMATCH");
    expect(src).toContain("SHASUMS256.txt");
    expect(src).toContain("refusing to bundle");
  });

  it("installs Playwright without lifecycle scripts, pinned to the lockfile", () => {
    expect(src).toContain('"--ignore-scripts"');
    expect(src).toContain("package-lock.json");
    expect(src).toContain("does not match package-lock.json");
  });

  it("emits a component inventory of bundled executables", () => {
    expect(src).toContain("inventory.json");
    expect(src).toContain('new Set([".exe", ".dll", ".so", ".dylib", ".bin"])');
  });
});

describe("GitHub Actions hardening", () => {
  it("has workflows to pin", () => {
    expect(workflows.length).toBeGreaterThanOrEqual(4);
  });

  it("pins every action to a full commit SHA", () => {
    for (const f of workflows) {
      const src = readFileSync(resolve(workflowsDir, f), "utf-8");
      const uses = src
        .split(/\r?\n/)
        .filter((l) => /^\s*-?\s*uses:/.test(l))
        .map((l) => l.replace(/^\s*-?\s*uses:\s*/, "").trim());
      expect(uses.length, `${f} has uses: entries`).toBeGreaterThan(0);
      for (const u of uses) {
        expect(
          /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}(\s+#.*)?$/.test(u),
          `${f}: unpinned action "${u}"`,
        ).toBe(true);
      }
    }
  });

  it("declares least-privilege permissions in every workflow", () => {
    for (const f of workflows) {
      const src = readFileSync(resolve(workflowsDir, f), "utf-8");
      expect(src, `${f} missing permissions block`).toMatch(/^permissions:/m);
    }
  });

  it("grants write access only to the release job", () => {
    const src = read(".github/workflows/release.yml");
    expect(src).toMatch(/^permissions:\n\x20{2}contents: read$/m);
    expect(src).toContain("attestations: write");
    expect(src).toContain("attest-build-provenance");
    // Build jobs must not carry write permissions.
    const buildJob = src.slice(
      src.indexOf("  build:"),
      src.indexOf("  release:"),
    );
    expect(buildJob).not.toContain("contents: write");
  });
});

describe("engine server security boundary", () => {
  const src = read("apps/desktop/server/index.ts");

  it("binds the diagnostic server to loopback only", () => {
    expect(src).toContain('app.listen(PORT, "127.0.0.1"');
  });

  it("validates URLs and viewport bounds on every scan-like endpoint", () => {
    expect(src.match(/validateUrl\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(src).toContain("w < 200");
    expect(src).toContain("h > 4320");
  });

  it("shuts down gracefully", () => {
    expect(src).toContain("SIGTERM");
    expect(src).toContain("server.close");
  });
});
