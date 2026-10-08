/**
 * Builds the MadScope desktop engine bundle for Tauri distribution.
 *
 * Layout produced under apps/desktop/src-tauri/resources/engine/:
 *   server.cjs          esbuild bundle (our TS + express/cors/pngjs/pixelmatch)
 *   node_modules/       real `playwright` install (kept external: native layout)
 *   node[.exe]          portable Node runtime (downloaded per platform)
 *   browsers/           Playwright Chromium (installed per platform)
 *
 * The Tauri app spawns `node server.cjs` from resources with
 * PLAYWRIGHT_BROWSERS_PATH and MADSCOPE_DATA_DIR set.
 *
 * Usage (run from apps/desktop):
 *   node scripts/build-sidecar.mjs --platform=win|mac-arm64|mac-x64|linux
 *
 * Requires network access (Node.js download, Playwright browser download).
 */
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(here, "..");
const repoRoot = resolve(desktopDir, "../..");
const engineDir = resolve(desktopDir, "src-tauri/resources/engine");

const NODE_VERSION = "v22.12.0";
const NODE_ASSETS = {
  win: `node-${NODE_VERSION}-win-x64.zip`,
  "mac-arm64": `node-${NODE_VERSION}-darwin-arm64.tar.gz`,
  "mac-x64": `node-${NODE_VERSION}-darwin-x64.tar.gz`,
  linux: `node-${NODE_VERSION}-linux-x64.tar.xz`,
};
const NODE_URL = `https://nodejs.org/dist/${NODE_VERSION}`;

function run(cmd, args, opts = {}) {
  // On Windows, npm/npx are .cmd shims and require a shell.
  const needsShell =
    process.platform === "win32" && (cmd === "npm" || cmd === "npx");
  const r = needsShell
    ? spawnSync("cmd", ["/c", cmd, ...args], { stdio: "inherit", ...opts })
    : spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0)
    throw new Error(`command failed: ${cmd} ${args.join(" ")}`);
}

function dirSizeMB(dir) {
  let bytes = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else bytes += statSync(p).size;
    }
  };
  walk(dir);
  return (bytes / 1024 / 1024).toFixed(1);
}

const platform = (
  process.argv.find((a) => a.startsWith("--platform=")) ?? ""
).split("=")[1];
if (!NODE_ASSETS[platform]) {
  console.error(
    `usage: node scripts/build-sidecar.mjs --platform=${Object.keys(NODE_ASSETS).join("|")}`,
  );
  process.exit(2);
}

console.log(`[sidecar] building engine for ${platform}`);

// 0. Fresh engine dir (ignored by git; assembled on the release runner).
rmSync(engineDir, { recursive: true, force: true });
mkdirSync(engineDir, { recursive: true });

// 1. Bundle the server (everything except playwright, which needs its on-disk layout).
console.log("[sidecar] bundling server.cjs");
const esbuild = require("esbuild");
esbuild.buildSync({
  entryPoints: [resolve(desktopDir, "server/index.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: resolve(engineDir, "server.cjs"),
  external: ["playwright", "playwright-core"],
  logLevel: "info",
});

// 2. Install the exact pinned playwright into the engine dir.
// NOTE: installed in a scratch dir outside the npm workspace tree so npm
// does not hoist it to the repo root; then copied in.
const playwrightVersion = JSON.parse(
  readFileSync(
    resolve(repoRoot, "node_modules/playwright/package.json"),
    "utf-8",
  ),
).version;
console.log(`[sidecar] installing playwright@${playwrightVersion}`);
const scratch = resolve(tmpdir(), `madscope-engine-${Date.now().toString(36)}`);
mkdirSync(scratch, { recursive: true });
writeFileSync(
  join(scratch, "package.json"),
  JSON.stringify({ name: "madscope-engine", private: true }),
);
run(
  "npm",
  [
    "install",
    "--omit=dev",
    "--no-audit",
    "--no-fund",
    `playwright@${playwrightVersion}`,
  ],
  { cwd: scratch },
);
mkdirSync(join(engineDir, "node_modules"), { recursive: true });
for (const name of ["playwright", "playwright-core"]) {
  const src = join(scratch, "node_modules", name);
  if (existsSync(src))
    cpSync(src, join(engineDir, "node_modules", name), { recursive: true });
}
rmSync(scratch, { recursive: true, force: true });

// 3. Download portable Node.
console.log(`[sidecar] downloading portable Node ${NODE_VERSION}`);
const asset = NODE_ASSETS[platform];
const dlDir = resolve(engineDir, ".dl");
mkdirSync(dlDir, { recursive: true });
run("curl", ["-fsSL", "-o", join(dlDir, asset), `${NODE_URL}/${asset}`]);
if (platform === "win") {
  run("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -Path "${join(dlDir, asset)}" -DestinationPath "${dlDir}" -Force`,
  ]);
  copyFileSync(
    join(dlDir, asset.replace(".zip", ""), "node.exe"),
    join(engineDir, "node.exe"),
  );
} else {
  run("tar", ["-xf", join(dlDir, asset), "-C", dlDir]);
  const folder = asset.replace(".tar.gz", "").replace(".tar.xz", "");
  copyFileSync(join(dlDir, folder, "bin/node"), join(engineDir, "node"));
  chmodSync(join(engineDir, "node"), 0o755);
}
rmSync(dlDir, { recursive: true, force: true });

// 4. Install the headless-shell Chromium into the engine dir.
// The engine only ever launches headless, which is exactly what the
// headless shell supports (screenshots, DOM, layout) at ~half the size.
console.log(
  "[sidecar] installing Chromium headless shell (this downloads ~120MB)",
);
const nodeBin = join(engineDir, platform === "win" ? "node.exe" : "node");
run(
  nodeBin,
  [
    join(engineDir, "node_modules/playwright/cli.js"),
    "install",
    "chromium",
    "--only-shell",
  ],
  {
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: join(engineDir, "browsers"),
    },
  },
);

// 5. Validate.
const checks = [
  ["server.cjs", join(engineDir, "server.cjs")],
  ["node runtime", nodeBin],
  ["playwright", join(engineDir, "node_modules/playwright/package.json")],
  ["browsers", join(engineDir, "browsers")],
];
for (const [label, p] of checks) {
  if (!existsSync(p)) throw new Error(`[sidecar] missing ${label}: ${p}`);
}
const versionOut = spawnSync(nodeBin, ["--version"], { encoding: "utf-8" });
console.log(
  `[sidecar] node ${versionOut.stdout.trim()} playwright ${playwrightVersion}`,
);
console.log(`[sidecar] engine size: ${dirSizeMB(engineDir)} MB (${engineDir})`);
console.log("[sidecar] OK");
