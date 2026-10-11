/**
 * Theme selection for the desktop UI.
 *
 * Exactly three themes exist: `existing` (shown as **Default** — the original
 * MadScope design and default), `terminal` and `light`. The internal id stays
 * `existing` so preferences saved by earlier releases keep working. The active
 * theme is written to the document as a `data-theme` attribute; CSS custom
 * properties in `src/index.css` map it to colors. The choice persists in
 * localStorage so it survives refreshes and later visits.
 */

export const THEME_IDS = ["existing", "terminal", "light"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_STORAGE_KEY = "madscope-theme";

export const THEME_LABELS: Record<ThemeId, string> = {
  existing: "Default",
  terminal: "Terminal",
  light: "Light",
};

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (THEME_IDS as readonly string[]).includes(value)
  );
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Storage access can throw (e.g. blocked cookies); treat as unavailable.
    return null;
  }
}

/** Reads the persisted theme, falling back to `existing` on anything odd. */
export function loadTheme(storage?: StorageLike | null): ThemeId {
  const source = storage === undefined ? defaultStorage() : storage;
  if (!source) return "existing";
  try {
    const stored = source.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : "existing";
  } catch {
    return "existing";
  }
}

/** Persists the theme. Failures are ignored: the theme still applies now. */
export function saveTheme(theme: ThemeId, storage?: StorageLike | null): void {
  const source = storage === undefined ? defaultStorage() : storage;
  if (!source) return;
  try {
    source.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private-mode/quota failures must not break the UI.
  }
}

/** Applies the theme to the document (no reload required). */
export function applyTheme(theme: ThemeId, doc?: Document | null): void {
  const target = doc ?? (typeof document === "undefined" ? null : document);
  if (!target) return;
  target.documentElement.setAttribute("data-theme", theme);
}
