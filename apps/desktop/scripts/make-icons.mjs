/**
 * Generates MadScope application icons from code (no external assets).
 * Run: `node scripts/make-icons.mjs` from apps/desktop.
 * Outputs src-tauri/icons/: 32x32.png, 128x128.png, 128x128@2x.png (256),
 * icon.ico (PNG-compressed, Vista+), icon.icns (PNG-compressed entries).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../src-tauri/icons");
mkdirSync(outDir, { recursive: true });

const SKY = [56, 189, 248, 255];
const INK = [12, 18, 34, 255];

function drawM(size) {
  const png = new PNG({ width: size, height: size });
  const r = Math.round(size * 0.22);
  const at = (x, y) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return (y * size + x) * 4;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inCorner =
        (x < r && y < r && (x - r) ** 2 + (y - r) ** 2 > r * r) ||
        (x >= size - r &&
          y < r &&
          (x - (size - r)) ** 2 + (y - r) ** 2 > r * r) ||
        (x < r &&
          y >= size - r &&
          (x - r) ** 2 + (y - (size - r)) ** 2 > r * r) ||
        (x >= size - r &&
          y >= size - r &&
          (x - (size - r)) ** 2 + (y - (size - r)) ** 2 > r * r);
      const c = inCorner ? [0, 0, 0, 0] : SKY;
      png.data[i] = c[0];
      png.data[i + 1] = c[1];
      png.data[i + 2] = c[2];
      png.data[i + 3] = c[3];
    }
  }
  // Block "M": two bars + inner V.
  const bar = (x0, x1, y0, y1) => {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) {
      for (let x = Math.round(x0); x <= Math.round(x1); x++) {
        const i = at(x, y);
        if (i !== null) {
          png.data[i] = INK[0];
          png.data[i + 1] = INK[1];
          png.data[i + 2] = INK[2];
          png.data[i + 3] = INK[3];
        }
      }
    }
  };
  const t = Math.max(2, Math.round(size * 0.075)); // stroke
  const top = size * 0.26;
  const bot = size * 0.74;
  const lx0 = size * 0.2;
  const rx1 = size * 0.8;
  bar(lx0, lx0 + t, top, bot);
  bar(rx1 - t, rx1, top, bot);
  // Diagonals from bar tops to center.
  const cx = size / 2;
  const cy = size * 0.6;
  const steps = Math.round(size * 0.4);
  for (let s = 0; s <= steps; s++) {
    const f = s / steps;
    bar(
      lx0 + t * 0.5 + (cx - lx0) * f - t / 2,
      lx0 + t * 0.5 + (cx - lx0) * f + t / 2,
      top + (cy - top) * f - t / 2,
      top + (cy - top) * f + t / 2,
    );
    bar(
      rx1 - t * 0.5 - (rx1 - cx) * f - t / 2,
      rx1 - t * 0.5 - (rx1 - cx) * f + t / 2,
      top + (cy - top) * f - t / 2,
      top + (cy - top) * f + t / 2,
    );
  }
  return PNG.sync.write(png);
}

const p32 = drawM(32);
const p128 = drawM(128);
const p256 = drawM(256);
const p512 = drawM(512);

writeFileSync(resolve(outDir, "32x32.png"), p32);
writeFileSync(resolve(outDir, "128x128.png"), p128);
writeFileSync(resolve(outDir, "128x128@2x.png"), p256);
writeFileSync(resolve(outDir, "512x512.png"), p512);

// ICO: ICONDIR + entries + PNG payloads.
{
  const entries = [p32, p128, p256];
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach((img, idx) => {
    const png = PNG.sync.read(img);
    const o = 6 + idx * 16;
    header[o] = png.width >= 256 ? 0 : png.width;
    header[o + 1] = png.height >= 256 ? 0 : png.height;
    header[o + 2] = 0;
    header[o + 3] = 0;
    header.writeUInt16LE(1, o + 4);
    header.writeUInt16LE(32, o + 6);
    header.writeUInt32LE(img.length, o + 8);
    header.writeUInt32LE(offset, o + 12);
    offset += img.length;
  });
  writeFileSync(
    resolve(outDir, "icon.ico"),
    Buffer.concat([header, ...entries]),
  );
}

// ICNS: 'icns' + BE length + (type, BE length, PNG) elements.
{
  const parts = [];
  const el = (type, png) => {
    const h = Buffer.alloc(8);
    h.write(type, 0, 4, "ascii");
    h.writeUInt32BE(8 + png.length, 4);
    parts.push(h, png);
  };
  el("ic07", p128);
  el("ic08", p256);
  el("ic09", p512);
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write("icns", 0, 4, "ascii");
  head.writeUInt32BE(8 + body.length, 4);
  writeFileSync(resolve(outDir, "icon.icns"), Buffer.concat([head, body]));
}

console.log(`icons written to ${outDir}`);
