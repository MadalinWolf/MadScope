import { describe, it, expect } from "vitest";
import {
  applyTheme,
  isThemeId,
  loadTheme,
  saveTheme,
  THEME_IDS,
  THEME_LABELS,
  THEME_STORAGE_KEY,
} from "../../apps/desktop/src/lib/themes";

type FakeStorage = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
};

function fakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

describe("theme set", () => {
  it("offers exactly three themes, each with a label", () => {
    expect([...THEME_IDS]).toEqual(["existing", "terminal", "light"]);
    for (const id of THEME_IDS) {
      expect(THEME_LABELS[id]).toBeTruthy();
    }
    expect(Object.keys(THEME_LABELS)).toHaveLength(3);
  });

  it("guards unknown values", () => {
    expect(isThemeId("terminal")).toBe(true);
    expect(isThemeId("light")).toBe(true);
    expect(isThemeId("solarized")).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(3)).toBe(false);
  });
});

describe("theme persistence", () => {
  it("defaults to the existing theme", () => {
    expect(loadTheme(fakeStorage())).toBe("existing");
    expect(loadTheme(null)).toBe("existing");
  });

  it("restores a persisted theme across visits", () => {
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: "terminal" });
    expect(loadTheme(storage)).toBe("terminal");
    saveTheme("light", storage);
    expect(loadTheme(storage)).toBe("light");
  });

  it("ignores unknown stored values", () => {
    expect(
      loadTheme(fakeStorage({ [THEME_STORAGE_KEY]: "solarized-dark" })),
    ).toBe("existing");
  });

  it("survives storage failures without throwing", () => {
    const hostile: FakeStorage = {
      getItem: () => {
        throw new Error("access denied");
      },
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };
    expect(loadTheme(hostile)).toBe("existing");
    expect(() => saveTheme("terminal", hostile)).not.toThrow();
  });

  it("persists via saveTheme", () => {
    const storage = fakeStorage();
    saveTheme("terminal", storage);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("terminal");
    expect(loadTheme(storage)).toBe("terminal");
  });
});

describe("applyTheme", () => {
  it("sets data-theme on the document element", () => {
    const attrs = new Map<string, string>();
    const doc = {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          attrs.set(k, v);
        },
      },
    } as unknown as Document;
    applyTheme("light", doc);
    expect(attrs.get("data-theme")).toBe("light");
    applyTheme("terminal", doc);
    expect(attrs.get("data-theme")).toBe("terminal");
  });

  it("is a no-op without a document (e.g. node tests)", () => {
    expect(() => applyTheme("light", null)).not.toThrow();
  });
});
