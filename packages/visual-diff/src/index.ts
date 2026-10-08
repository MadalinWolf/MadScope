import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export type DiffResult = {
  width: number;
  height: number;
  totalPixels: number;
  changedPixels: number;
  changeRatio: number;
  passed: boolean;
  diffPng: Buffer;
};

/**
 * Deterministic pixel diff. Images of different sizes are compared over the
 * overlapping region; non-overlapping pixels count as changed.
 */
export function comparePngBuffers(
  a: Buffer,
  b: Buffer,
  threshold = 0.005,
  diffThreshold = 0.1,
): DiffResult {
  const imgA = PNG.sync.read(a);
  const imgB = PNG.sync.read(b);
  const width = Math.max(imgA.width, imgB.width);
  const height = Math.max(imgA.height, imgB.height);

  const norm = (img: PNG, w: number, h: number): PNG => {
    if (img.width === w && img.height === h) return img;
    const out = new PNG({ width: w, height: h });
    out.data.fill(0);
    for (let y = 0; y < Math.min(img.height, h); y++) {
      for (let x = 0; x < Math.min(img.width, w); x++) {
        const si = (img.width * y + x) * 4;
        const di = (w * y + x) * 4;
        out.data[di] = img.data[si];
        out.data[di + 1] = img.data[si + 1];
        out.data[di + 2] = img.data[si + 2];
        out.data[di + 3] = img.data[si + 3];
      }
    }
    return out;
  };

  const na = norm(imgA, width, height);
  const nb = norm(imgB, width, height);
  const diff = new PNG({ width, height });
  const changedPixels = pixelmatch(na.data, nb.data, diff.data, width, height, {
    threshold: diffThreshold,
  });
  const totalPixels = width * height;
  const changeRatio = totalPixels === 0 ? 0 : changedPixels / totalPixels;
  return {
    width,
    height,
    totalPixels,
    changedPixels,
    changeRatio,
    passed: changeRatio <= threshold,
    diffPng: PNG.sync.write(diff),
  };
}

export function formatChangeRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}
