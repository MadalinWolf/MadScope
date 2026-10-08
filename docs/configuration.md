# Configuration

`madscope.config.ts` (or `.js`/`.mjs`/`.json`) in cwd, loaded via `loadConfig()`:

```ts
import { defineConfig } from "@madscope/config";
export default defineConfig({
  urls: ["https://example.com"],
  viewports: [{ id: "mobile", name: "Mobile", width: 390, height: 844 }],
  screenshot: {
    type: "png",
    fullPage: false,
    animations: "disabled",
    colorScheme: "no-preference",
    reducedMotion: "reduce",
    locale: "en-US",
  },
  diffThreshold: 0.005, // 0..1 fraction of changed pixels
  waitTime: 500, // ms after load before capture
  navigationTimeout: 30000,
  outDir: ".madscope/screenshots",
  baselineDir: ".madscope/baselines",
  resultsDir: ".madscope/results",
});
```

Validation errors throw with human-readable messages. Run `madscope config --init` to scaffold.
