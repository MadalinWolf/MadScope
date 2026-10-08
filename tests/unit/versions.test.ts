import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readJson(rel: string): {
  version?: string;
  dependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(resolve(root, rel), "utf-8"));
}

describe("version sync", () => {
  it("all workspace packages share the root version", () => {
    const rootPkg = readJson("package.json");
    expect(rootPkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    const manifests = [
      "apps/cli/package.json",
      "apps/desktop/package.json",
      "packages/shared/package.json",
      "packages/config/package.json",
      "packages/browser/package.json",
      "packages/screenshots/package.json",
      "packages/visual-diff/package.json",
      "packages/issue-detector/package.json",
      "packages/core/package.json",
    ];
    for (const m of manifests) {
      expect(existsSync(resolve(root, m)), m).toBe(true);
      const pkg = readJson(m);
      expect(pkg.version, m).toBe(rootPkg.version);
      for (const [dep, spec] of Object.entries(pkg.dependencies ?? {})) {
        if (dep.startsWith("@madscope/")) {
          expect(spec, `${m} -> ${dep}`).toBe(rootPkg.version);
        }
      }
    }
  });

  it("tauri config and cargo agree with the root version", () => {
    const rootPkg = readJson("package.json");
    const tauri = JSON.parse(
      readFileSync(
        resolve(root, "apps/desktop/src-tauri/tauri.conf.json"),
        "utf-8",
      ),
    );
    expect(tauri.version).toBe(rootPkg.version);
    const cargo = readFileSync(
      resolve(root, "apps/desktop/src-tauri/Cargo.toml"),
      "utf-8",
    );
    expect(cargo).toContain(`version = "${rootPkg.version}"`);
  });
});
