import { chromium, type Browser } from "playwright";
import type { ViewportConfig } from "@madscope/shared";
import type { MadScopeConfig } from "@madscope/config";

export type LayoutSnapshot = {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  overflowing: Array<{
    selector: string;
    width: number;
    viewportWidth: number;
  }>;
  images: Array<{
    selector: string;
    src: string;
    width: number;
    containerWidth: number;
    overflowing: boolean;
  }>;
  touchTargets: Array<{
    selector: string;
    label: string;
    width: number;
    height: number;
    tooSmall: boolean;
  }>;
  overlaps: Array<{ a: string; b: string }>;
  offscreen: Array<{
    selector: string;
    left: number;
    right: number;
    viewportWidth: number;
  }>;
  clippedText: Array<{ selector: string; text: string }>;
};

export type RenderResult = {
  url: string;
  viewport: ViewportConfig;
  screenshot: Buffer;
  layout: LayoutSnapshot;
  title: string;
  loadTimeMs: number;
};

export class BrowserEngine {
  private browser: Browser | null = null;
  private launchCount = 0;

  async launch(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--force-color-profile=srgb",
        ],
      });
    } catch (err) {
      throw new Error(
        `MadScope could not launch the browser.\n${err instanceof Error ? err.message : String(err)}\n\nTry:\n- running "npx playwright install chromium"\n- checking disk space and antivirus blocks`,
      );
    }
    this.launchCount += 1;
    return this.browser;
  }

  getLaunchCount(): number {
    return this.launchCount;
  }

  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // ignore close errors
      }
      this.browser = null;
    }
  }

  async renderViewport(
    url: string,
    viewport: ViewportConfig,
    config: MadScopeConfig,
  ): Promise<RenderResult> {
    const browser = await this.launch();
    const started = Date.now();
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
      userAgent: viewport.userAgent,
      isMobile: viewport.isMobile ?? false,
      hasTouch: viewport.hasTouch ?? false,
      colorScheme:
        config.screenshot.colorScheme === "no-preference"
          ? "no-preference"
          : config.screenshot.colorScheme,
      reducedMotion: config.screenshot.reducedMotion,
      locale: config.screenshot.locale,
      timezoneId: config.screenshot.timezone,
    });
    const page = await context.newPage();
    try {
      if (config.screenshot.animations === "disabled") {
        await page
          .addStyleTag({
            content: `*, *::before, *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }`,
          })
          .catch(() => undefined);
      }
      let navError: Error | null = null;
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: config.navigationTimeout,
        });
        await page
          .waitForLoadState("networkidle", { timeout: 8000 })
          .catch(() => undefined);
      } catch (err) {
        navError = err instanceof Error ? err : new Error(String(err));
      }
      if (navError) {
        throw new Error(
          `MadScope could not load the page.\n${navError.message}\n\nTry:\n- checking the URL\n- confirming the local server is running\n- trying again`,
        );
      }
      if (config.waitTime > 0) {
        await page.waitForTimeout(config.waitTime);
      }
      const title = await page.title().catch(() => "");
      const layout = await page.evaluate(collectLayout, viewport.width);
      const screenshot = await page.screenshot({
        type: config.screenshot.type === "jpeg" ? "jpeg" : "png",
        quality:
          config.screenshot.type === "jpeg"
            ? (config.screenshot.quality ?? 85)
            : undefined,
        fullPage: config.screenshot.fullPage,
      });
      return {
        url,
        viewport,
        screenshot,
        layout,
        title,
        loadTimeMs: Date.now() - started,
      };
    } finally {
      await context.close().catch(() => undefined);
    }
  }
}

/** Runs inside the page. Must stay serializable (no imports). */
function collectLayout(viewportWidth: number): LayoutSnapshot {
  const selectorOf = (el: Element): string => {
    const parts: string[] = [];
    let cur: Element | null = el;
    let depth = 0;
    while (cur && depth < 4 && cur.tagName.toLowerCase() !== "html") {
      let part = cur.tagName.toLowerCase();
      if ((cur as HTMLElement).id) part += `#${(cur as HTMLElement).id}`;
      else {
        const cls =
          typeof (cur as HTMLElement).className === "string"
            ? (cur as HTMLElement).className
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .join(".")
            : "";
        if (cls) part += `.${cls}`;
      }
      parts.unshift(part);
      cur = cur.parentElement;
      depth += 1;
    }
    return parts.join(" > ") || "body";
  };
  const visible = (el: Element): boolean => {
    const r = (el as HTMLElement).getBoundingClientRect();
    const style = getComputedStyle(el as HTMLElement);
    return (
      r.width > 0 &&
      r.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  };

  const overflowing: LayoutSnapshot["overflowing"] = [];
  const all = Array.from(document.querySelectorAll("body *")).slice(
    0,
    800,
  ) as HTMLElement[];
  for (const el of all) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > viewportWidth + 1 || r.left < -1) {
      if (r.width > 40) {
        overflowing.push({
          selector: selectorOf(el),
          width: Math.round(r.width),
          viewportWidth,
        });
        if (overflowing.length >= 25) break;
      }
    }
  }

  const images: LayoutSnapshot["images"] = [];
  for (const img of Array.from(document.querySelectorAll("img")).slice(
    0,
    100,
  ) as HTMLImageElement[]) {
    if (!visible(img)) continue;
    const r = img.getBoundingClientRect();
    const parent = img.parentElement;
    const pw = parent ? parent.getBoundingClientRect().width : viewportWidth;
    images.push({
      selector: selectorOf(img),
      src: (img.currentSrc || img.src || "").slice(0, 200),
      width: Math.round(r.width),
      containerWidth: Math.round(pw),
      overflowing: pw > 0 && r.width > pw + 1,
    });
  }

  const touchTargets: LayoutSnapshot["touchTargets"] = [];
  for (const el of Array.from(
    document.querySelectorAll(
      "a, button, input, select, textarea, [role='button']",
    ),
  ).slice(0, 150) as HTMLElement[]) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (w === 0 && h === 0) continue;
    const tooSmall = w < 24 || h < 24;
    if (tooSmall || touchTargets.length < 60) {
      const label = (
        el.textContent ||
        el.getAttribute("aria-label") ||
        el.tagName
      )
        .trim()
        .slice(0, 60);
      touchTargets.push({
        selector: selectorOf(el),
        label,
        width: w,
        height: h,
        tooSmall,
      });
    }
    if (touchTargets.filter((t) => t.tooSmall).length >= 25) break;
  }

  const overlaps: LayoutSnapshot["overlaps"] = [];
  const boxes = all
    .filter(visible)
    .slice(0, 120)
    .map((el) => ({ el, r: el.getBoundingClientRect() }));
  outer: for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const xOverlap =
        Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const yOverlap =
        Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (xOverlap > 8 && yOverlap > 8) {
        const areaA = a.r.width * a.r.height;
        const areaB = b.r.width * b.r.height;
        if (areaA > 500 && areaB > 500) {
          overlaps.push({ a: selectorOf(a.el), b: selectorOf(b.el) });
          if (overlaps.length >= 15) break outer;
        }
      }
    }
  }

  const offscreen: LayoutSnapshot["offscreen"] = [];
  for (const el of all.slice(0, 300)) {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width > 20 && (r.left >= viewportWidth || r.right <= 0)) {
      offscreen.push({
        selector: selectorOf(el),
        left: Math.round(r.left),
        right: Math.round(r.right),
        viewportWidth,
      });
      if (offscreen.length >= 15) break;
    }
  }

  const clippedText: LayoutSnapshot["clippedText"] = [];
  for (const el of all.slice(0, 300) as HTMLElement[]) {
    const style = getComputedStyle(el);
    if (
      (style.overflow === "hidden" || style.textOverflow === "ellipsis") &&
      style.whiteSpace === "nowrap"
    ) {
      if (el.scrollWidth > el.clientWidth + 2) {
        clippedText.push({
          selector: selectorOf(el),
          text: (el.textContent || "").trim().slice(0, 120),
        });
        if (clippedText.length >= 15) break;
      }
    }
  }

  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    overflowing,
    images,
    touchTargets,
    overlaps,
    offscreen,
    clippedText,
  };
}
