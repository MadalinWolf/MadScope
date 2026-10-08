#!/usr/bin/env node
import { Command } from "commander";
import {
  validateUrl,
  VIEWPORT_PRESETS,
  createCustomViewport,
  type ViewportConfig,
} from "@madscope/shared";
import {
  loadConfig,
  initConfigFile,
  mergeConfig,
  type MadScopeConfig,
} from "@madscope/config";
import {
  scanUrl,
  createBaseline,
  runRegressionTest,
  closeEngine,
} from "@madscope/core";

const program = new Command();
program
  .name("madscope")
  .description(
    "MadScope — local-first responsive testing and visual regression",
  )
  .version("1.0.1");

function resolveViewports(opts: {
  viewport?: string[];
  width?: string;
  height?: string;
  device?: string;
}): ViewportConfig[] {
  if (opts.width || opts.height) {
    const w = Number(opts.width ?? 1440);
    const h = Number(opts.height ?? 900);
    if (!Number.isInteger(w) || !Number.isInteger(h))
      throw new Error("--width and --height must be integers.");
    return [createCustomViewport(`Custom ${w}×${h}`, w, h)];
  }
  if (opts.viewport && opts.viewport.length > 0) {
    const out: ViewportConfig[] = [];
    for (const id of opts.viewport) {
      const preset = VIEWPORT_PRESETS.find(
        (p) => p.id === id || p.name.toLowerCase() === id.toLowerCase(),
      );
      if (!preset)
        throw new Error(
          `Unknown viewport "${id}". Available: ${VIEWPORT_PRESETS.map((p) => p.id).join(", ")}`,
        );
      const { category: _c, ...rest } = preset;
      out.push(rest);
    }
    return out;
  }
  if (opts.device === "mobile") {
    return VIEWPORT_PRESETS.filter((p) => p.id === "mobile").map(
      ({ category: _c, ...r }) => r,
    );
  }
  return VIEWPORT_PRESETS.filter((p) =>
    ["mobile", "tablet", "desktop"].includes(p.id),
  ).map(({ category: _c, ...r }) => r);
}

async function withConfig(
  overrides: Partial<MadScopeConfig>,
  fullPage?: boolean,
): Promise<MadScopeConfig> {
  const base = await loadConfig(process.cwd());
  const merged = mergeConfig(base, {
    ...overrides,
    screenshot: {
      ...base.screenshot,
      ...(overrides.screenshot ?? {}),
      ...(fullPage ? { fullPage: true } : {}),
    },
  });
  return merged;
}

function printScan(url: string, scan: Awaited<ReturnType<typeof scanUrl>>) {
  console.log(`\nMadScope results for ${url}`);
  console.log(`Responsive Health: ${scan.health.score} / 100`);
  for (const r of scan.results) {
    console.log(
      `\n[${r.viewport.name} ${r.viewport.width}x${r.viewport.height}] ${r.title || ""} (${r.loadTimeMs}ms)`,
    );
    console.log(`  screenshot: ${r.screenshot.screenshotPath}`);
    if (r.issues.length === 0) console.log("  ✓ No potential issues detected.");
    else
      for (const i of r.issues.slice(0, 12))
        console.log(
          `  ! [${i.severity}] ${i.type}: ${i.message}${i.selector ? ` (${i.selector})` : ""}`,
        );
  }
  console.log("");
}

program
  .command("screenshot <url>", { isDefault: true })
  .description("Render a URL across viewports and capture screenshots")
  .option(
    "--viewport <id...>",
    "viewport preset ids (e.g. mobile tablet desktop)",
  )
  .option("--width <n>", "custom width")
  .option("--height <n>", "custom height")
  .option("--device <name>", "device shortcut (e.g. mobile)")
  .option("--full-page", "capture full-page screenshots")
  .option("--output <dir>", "output directory")
  .action(async (url: string, opts) => {
    const v = validateUrl(url);
    if (!v.ok) {
      console.error(`Error: ${v.error}`);
      process.exitCode = 2;
      return;
    }
    try {
      const viewports = resolveViewports(opts);
      const config = await withConfig(
        opts.output ? { outDir: opts.output } : {},
        opts.fullPage,
      );
      const scan = await scanUrl(v.url, viewports, config);
      printScan(v.url, scan);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      await closeEngine();
    }
  });

program
  .command("baseline <url>")
  .description("Save baseline screenshots for visual regression")
  .option("--viewport <id...>", "viewport preset ids")
  .option("--width <n>", "custom width")
  .option("--height <n>", "custom height")
  .option("--full-page", "capture full-page screenshots")
  .action(async (url: string, opts) => {
    const v = validateUrl(url);
    if (!v.ok) {
      console.error(`Error: ${v.error}`);
      process.exitCode = 2;
      return;
    }
    try {
      const viewports = resolveViewports(opts);
      const config = await withConfig({}, opts.fullPage);
      const entries = await createBaseline(v.url, viewports, config);
      console.log(`Baseline saved for ${v.url}:`);
      for (const e of entries)
        console.log(`  ✓ ${e.viewportId} ${e.width}x${e.height} -> ${e.file}`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      await closeEngine();
    }
  });

program
  .command("test <url>")
  .description("Compare current renders against baselines")
  .option("--viewport <id...>", "viewport preset ids")
  .option("--width <n>", "custom width")
  .option("--height <n>", "custom height")
  .option("--full-page", "capture full-page screenshots")
  .option("--threshold <n>", "override diff threshold 0..1")
  .option("--json", "print the report as JSON (for CI integrations)")
  .action(async (url: string, opts) => {
    const v = validateUrl(url);
    if (!v.ok) {
      console.error(`Error: ${v.error}`);
      process.exitCode = 2;
      return;
    }
    try {
      const viewports = resolveViewports(opts);
      const base = await withConfig({}, opts.fullPage);
      const threshold =
        opts.threshold !== undefined
          ? Number(opts.threshold)
          : base.diffThreshold;
      const config = { ...base, diffThreshold: threshold };
      const report = await runRegressionTest(v.url, viewports, config);
      let failed = false;
      for (const c of report.cases) {
        if (
          c.status === "fail" ||
          c.status === "error" ||
          c.status === "no-baseline"
        )
          failed = true;
      }
      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              url: report.url,
              passed: report.passed,
              threshold: config.diffThreshold,
              cases: report.cases.map((c) => ({
                viewport: c.viewport.id,
                name: c.viewport.name,
                width: c.viewport.width,
                height: c.viewport.height,
                status: c.status,
                changeRatio: c.changeRatio ?? null,
                changedPixels: c.changedPixels ?? null,
                threshold: c.threshold,
                baselineFile: c.baselineFile ?? null,
                actualFile: c.actualFile ?? null,
                diffFile: c.diffFile ?? null,
                message: c.message,
              })),
            },
            null,
            2,
          ),
        );
        if (failed) process.exitCode = 1;
        return;
      }
      for (const c of report.cases) {
        const icon =
          c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "?";
        const extra =
          c.changeRatio !== undefined
            ? ` Changed pixels: ${(c.changeRatio * 100).toFixed(2)}% Threshold: ${(c.threshold * 100).toFixed(2)}%`
            : "";
        console.log(
          `${icon} ${c.viewport.name} ${c.viewport.width}×${c.viewport.height} — ${c.message}${extra}`,
        );
      }
      if (failed) {
        console.log("\nVisual difference detected or baseline missing.");
        process.exitCode = 1;
      } else {
        console.log("\nAll visual tests passed.");
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    } finally {
      await closeEngine();
    }
  });

program
  .command("config")
  .description("Manage MadScope config")
  .option("--init", "create madscope.config.ts in cwd")
  .action(async (opts) => {
    if (opts.init) {
      try {
        const f = initConfigFile(process.cwd());
        console.log(`Created ${f}`);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
      return;
    }
    const c = await loadConfig(process.cwd());
    console.log(JSON.stringify(c, null, 2));
  });

if (process.argv.length <= 2) {
  program.help();
} else {
  await program.parseAsync(process.argv);
}
