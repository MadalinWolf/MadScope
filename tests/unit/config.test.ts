import { describe, it, expect } from "vitest";
import { defineConfig, validateConfig, DEFAULT_CONFIG } from "@madscope/config";

describe("config", () => {
  it("has sane defaults", () => {
    expect(DEFAULT_CONFIG.viewports.length).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.diffThreshold).toBeGreaterThan(0);
  });
  it("rejects invalid threshold", () => {
    expect(
      validateConfig({ ...DEFAULT_CONFIG, diffThreshold: 5 }).length,
    ).toBeGreaterThan(0);
  });
  it("defineConfig merges partial", () => {
    const c = defineConfig({ diffThreshold: 0.01 });
    expect(c.diffThreshold).toBe(0.01);
    expect(c.viewports.length).toBe(DEFAULT_CONFIG.viewports.length);
  });
});
