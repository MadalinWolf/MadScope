import { describe, it, expect } from "vitest";
import {
  buildScreenshotFilename,
  slugifyUrl,
  listHistory,
} from "@madscope/screenshots";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("screenshot metadata", () => {
  it("builds stable filenames", () => {
    const f = buildScreenshotFilename("https://example.com/", {
      id: "mobile",
      name: "Mobile",
      width: 390,
      height: 844,
    });
    expect(f).toContain("mobile");
    expect(f.endsWith(".png")).toBe(true);
  });
  it("slugifies urls", () => {
    expect(slugifyUrl("https://example.com")).toContain("example-com");
  });
  it("history is empty for fresh dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "mds-"));
    expect(listHistory(dir)).toEqual([]);
  });
});
