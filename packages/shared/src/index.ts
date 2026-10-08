export type ViewportConfig = {
  id: string;
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  userAgent?: string;
  isMobile?: boolean;
  hasTouch?: boolean;
};

export type ViewportCategory = "mobile" | "tablet" | "desktop" | "custom";

export type ViewportPreset = ViewportConfig & {
  category: ViewportCategory;
};

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  {
    id: "mobile-small",
    name: "Mobile Small",
    width: 320,
    height: 568,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    category: "mobile",
  },
  {
    id: "mobile",
    name: "Mobile",
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    category: "mobile",
  },
  {
    id: "mobile-large",
    name: "Mobile Large",
    width: 430,
    height: 932,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    category: "mobile",
  },
  {
    id: "tablet",
    name: "Tablet",
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    category: "tablet",
  },
  {
    id: "tablet-large",
    name: "Tablet Large",
    width: 1024,
    height: 1366,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    category: "tablet",
  },
  {
    id: "laptop",
    name: "Laptop",
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    category: "desktop",
  },
  {
    id: "desktop",
    name: "Desktop",
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    category: "desktop",
  },
  {
    id: "desktop-large",
    name: "Large Desktop",
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    category: "desktop",
  },
];

export function getPresetById(id: string): ViewportPreset | undefined {
  return VIEWPORT_PRESETS.find((p) => p.id === id);
}

export function validateViewport(v: Partial<ViewportConfig>): string[] {
  const errors: string[] = [];
  if (!v.name || typeof v.name !== "string" || v.name.trim().length === 0) {
    errors.push("Viewport name must be a non-empty string.");
  }
  if (
    !Number.isInteger(v.width) ||
    (v.width as number) < 200 ||
    (v.width as number) > 7680
  ) {
    errors.push("Viewport width must be an integer between 200 and 7680.");
  }
  if (
    !Number.isInteger(v.height) ||
    (v.height as number) < 200 ||
    (v.height as number) > 4320
  ) {
    errors.push("Viewport height must be an integer between 200 and 4320.");
  }
  if (v.deviceScaleFactor !== undefined) {
    if (
      typeof v.deviceScaleFactor !== "number" ||
      v.deviceScaleFactor < 0.5 ||
      v.deviceScaleFactor > 4
    ) {
      errors.push("deviceScaleFactor must be a number between 0.5 and 4.");
    }
  }
  return errors;
}

export function createCustomViewport(
  name: string,
  width: number,
  height: number,
): ViewportConfig {
  const viewport: ViewportConfig = {
    id: `custom-${width}x${height}-${Date.now().toString(36)}`,
    name: name || `Custom ${width}×${height}`,
    width,
    height,
    deviceScaleFactor: 1,
    isMobile: width < 768,
    hasTouch: width < 768,
  };
  const errors = validateViewport(viewport);
  if (errors.length > 0) {
    throw new Error(`Invalid viewport: ${errors.join(" ")}`);
  }
  return viewport;
}

export type UrlValidationResult =
  { ok: true; url: string } | { ok: false; error: string };

/**
 * Validate a URL for testing. Allows http/https including localhost and IPs.
 * Returns normalized URL string on success.
 */
export function validateUrl(input: string): UrlValidationResult {
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a URL, e.g. https://example.com" };
  }
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      ok: false,
      error: `"${trimmed}" is not a valid URL. Example: https://example.com`,
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      error: `Unsupported protocol "${parsed.protocol}". Use http:// or https:// (localhost is allowed).`,
    };
  }
  if (!parsed.hostname) {
    return {
      ok: false,
      error: "URL must include a hostname, e.g. https://example.com",
    };
  }
  return { ok: true, url: parsed.toString() };
}

export function formatViewportLabel(
  v: Pick<ViewportConfig, "name" | "width" | "height">,
): string {
  return `${v.name} ${v.width}×${v.height}`;
}
