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
 *
 * Security posture (see SECURITY_AUDIT.md):
 * - The Node.js archive is verified against SHA-256 hashes pinned in this
 *   script (obtained from the official nodejs.org dist SHASUMS256.txt index
 *   at authoring time) and cross-checked against the SHASUMS256.txt served by
 *   nodejs.org at build time. A mismatch fails the build.
 * - The Playwright install runs with --ignore-scripts and its version is
 *   asserted against the workspace lockfile.
 * - A deterministic SHA-256 inventory of every bundled executable is written
 *   to resources/engine/inventory.json (also printed in CI logs).
 */
import {
  chmodSync,
  copyFileSync,
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
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

// SHA-256 of each official Node.js archive above, pinned at authoring time
// from https://nodejs.org/dist/v22.12.0/SHASUMS256.txt (the canonical index
// published by the Node.js release team; SHASUMS256.txt itself carries a
// detached GPG signature we intentionally do not depend on at build time).
// These are the independent expected hashes the build must match.
const NODE_SHA256 = {
  win: "2b8f2256382f97ad51e29ff71f702961af466c4616393f767455501e6aece9b8",
  "mac-arm64":
    "293dcc6c2408da21562d135b0412525e381bb6fe150d688edb58fe850d0f3e13",
  "mac-x64": "52bc25dd026db7247c3c00439afdb83e95087248267f02d6c1a7250d1f896173",
  linux: "22982235e1b71fa8850f82edd09cdae7e3f32df1764a9ec298c72d25ef2c164f",
};

function sha256File(path) {
  return new Promise((resolvePromise, rejectPromise) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("error", rejectPromise)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolvePromise(hash.digest("hex")));
  });
}

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
// Lockfile enforcement: the version must match what `npm ci` installed from
// package-lock.json, so the sidecar can never drift from the audited tree.
const lockedPlaywright = JSON.parse(
  readFileSync(resolve(repoRoot, "package-lock.json"), "utf-8"),
).packages?.["node_modules/playwright"]?.version;
if (lockedPlaywright !== playwrightVersion) {
  throw new Error(
    `[sidecar] playwright in node_modules (${playwrightVersion}) does not match package-lock.json (${lockedPlaywright}); run npm ci`,
  );
}
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
    // No lifecycle scripts: the engine never needs them, and this keeps the
    // sidecar install to exactly the files the lockfile describes.
    "--ignore-scripts",
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

// 3. Download portable Node and verify it against pinned + publisher hashes.
console.log(`[sidecar] downloading portable Node ${NODE_VERSION}`);
const asset = NODE_ASSETS[platform];
const dlDir = resolve(engineDir, ".dl");
mkdirSync(dlDir, { recursive: true });
run("curl", ["-fsSL", "-o", join(dlDir, asset), `${NODE_URL}/${asset}`]);
{
  const expected = NODE_SHA256[platform];
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) {
    throw new Error(`[sidecar] missing/invalid pinned SHA-256 for ${platform}`);
  }
  const actual = await sha256File(join(dlDir, asset));
  if (actual !== expected) {
    throw new Error(
      `[sidecar] SHA-256 MISMATCH for ${asset}: pinned ${expected}, downloaded ${actual} — refusing to bundle`,
    );
  }
  // Cross-check against the index nodejs.org serves right now: the pinned
  // hash must still be listed there for this asset.
  run("curl", [
    "-fsSL",
    "-o",
    join(dlDir, "SHASUMS256.txt"),
    `${NODE_URL}/SHASUMS256.txt`,
  ]);
  const sums = readFileSync(join(dlDir, "SHASUMS256.txt"), "utf-8");
  if (!sums.split(/\r?\n/).includes(`${expected}  ${asset}`)) {
    throw new Error(
      `[sidecar] nodejs.org SHASUMS256.txt no longer lists the pinned hash for ${asset} — investigate before building`,
    );
  }
  console.log(`[sidecar] node archive verified (sha256 ${actual})`);
}
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

// 6. Deterministic component inventory: SHA-256 of every executable and every
// top-level file in the engine, written to resources/engine/inventory.json
// (shipped inside the installer and printed in CI logs so reviewers can
// compare bundled executables against expectations — see SECURITY_AUDIT.md).
const EXEC_EXT = new Set([".exe", ".dll", ".so", ".dylib", ".bin"]);
const isExec = (p) => EXEC_EXT.has(p.slice(p.lastIndexOf(".")).toLowerCase());
const invPaths = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === ".dl") continue; // scratch downloads, removed above
      walk(p);
    } else if (isExec(p) || !relative(engineDir, p).includes("/")) {
      invPaths.push(p);
    }
  }
})(engineDir);
invPaths.sort();
const invFiles = [];
for (const p of invPaths) {
  invFiles.push({
    path: relative(engineDir, p).replaceAll("\\", "/"),
    size: statSync(p).size,
    sha256: await sha256File(p),
  });
}
const inventory = {
  component: "madscope-desktop-engine",
  platform,
  node: NODE_VERSION,
  playwright: playwrightVersion,
  note: "SHA-256 of every bundled executable and top-level file (inventory.json itself excluded).",
  executables: invFiles.filter((f) => isExec(f.path)).length,
  files: invFiles,
};
writeFileSync(
  join(engineDir, "inventory.json"),
  JSON.stringify(inventory, null, 2) + "\n",
);
console.log(
  `[sidecar] inventory: ${invFiles.length} files, ${inventory.executables} executables -> engine/inventory.json`,
);
for (const f of invFiles.filter((f) => isExec(f.path))) {
  console.log(
    `[sidecar]   ${f.sha256}  ${String(f.size).padStart(10)}  ${f.path}`,
  );
}
console.log("[sidecar] OK");
