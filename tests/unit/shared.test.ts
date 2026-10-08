import { describe, it, expect } from "vitest";
import {
  validateUrl,
  VIEWPORT_PRESETS,
  validateViewport,
  createCustomViewport,
} from "@madscope/shared";

describe("url validation", () => {
  it("accepts https urls", () => {
    expect(validateUrl("https://example.com")).toEqual({
      ok: true,
      url: "https://example.com/",
    });
  });
  it("accepts localhost http", () => {
    const r = validateUrl("http://localhost:3000");
    expect(r.ok).toBe(true);
  });
  it("accepts 127.0.0.1", () => {
    expect(validateUrl("http://127.0.0.1:5173").ok).toBe(true);
  });
  it("rejects empty", () => {
    expect(validateUrl("").ok).toBe(false);
  });
  it("rejects ftp", () => {
    expect(validateUrl("ftp://example.com").ok).toBe(false);
  });
  it("adds https when scheme missing", () => {
    const r = validateUrl("example.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url).toContain("example.com");
  });
});

describe("viewport presets", () => {
  it("has mobile, tablet, desktop presets", () => {
    const ids = VIEWPORT_PRESETS.map((p) => p.id);
    expect(ids).toContain("mobile");
    expect(ids).toContain("tablet");
    expect(ids).toContain("desktop");
  });
  it("validates dimensions", () => {
    expect(
      validateViewport({ name: "x", width: 100, height: 800 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateViewport({ name: "x", width: 390, height: 844 }).length,
    ).toBe(0);
  });
  it("creates custom viewports", () => {
    const v = createCustomViewport("Custom", 1440, 900);
    expect(v.width).toBe(1440);
    expect(() => createCustomViewport("bad", 10, 10)).toThrow();
  });
});
