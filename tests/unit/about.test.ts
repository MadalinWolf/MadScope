import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ABOUT } from "../../apps/desktop/src/lib/about";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("about metadata", () => {
  it("reports the real current application version", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(root, "apps/desktop/package.json"), "utf-8"),
    ) as { version?: string };
    expect(ABOUT.version).toBe(pkg.version);
    expect(ABOUT.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("uses the genuine project links", () => {
    expect(ABOUT.repositoryUrl).toBe("https://github.com/MadalinWolf/MadScope");
    expect(ABOUT.websiteUrl).toBe("https://madwolfstudios.com/");
    expect(ABOUT.licenseUrl).toBe(
      "https://github.com/MadalinWolf/MadScope/blob/master/LICENSE",
    );
  });

  it("states the license that the repository actually carries", () => {
    const license = readFileSync(resolve(root, "LICENSE"), "utf-8");
    expect(license).toContain("MIT License");
    expect(ABOUT.license).toBe("MIT");
  });

  it("has a real studio name and a meaningful description", () => {
    expect(ABOUT.studio).toBe("Madwolf Studios");
    expect(ABOUT.description.length).toBeGreaterThan(40);
    expect(ABOUT.name).toBe("MadScope");
    expect(ABOUT.acknowledgments.length).toBeGreaterThan(10);
  });
});
