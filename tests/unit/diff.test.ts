import { describe, it, expect } from "vitest";
import { PNG } from "pngjs";
import { comparePngBuffers } from "@madscope/visual-diff";

function solid(w: number, h: number, r: number, g: number, b: number): Buffer {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

describe("visual diff", () => {
  it("identical images pass with 0 change", () => {
    const a = solid(20, 20, 255, 255, 255);
    const d = comparePngBuffers(a, a, 0.005);
    expect(d.changedPixels).toBe(0);
    expect(d.changeRatio).toBe(0);
    expect(d.passed).toBe(true);
  });
  it("different images fail", () => {
    const a = solid(20, 20, 255, 255, 255);
    const b = solid(20, 20, 0, 0, 0);
    const d = comparePngBuffers(a, b, 0.005);
    expect(d.changeRatio).toBeGreaterThan(0.9);
    expect(d.passed).toBe(false);
  });
  it("is deterministic", () => {
    const a = solid(10, 10, 200, 200, 200);
    const b = solid(10, 10, 210, 210, 210);
    expect(comparePngBuffers(a, b).changedPixels).toBe(
      comparePngBuffers(a, b).changedPixels,
    );
  });
});
