import { describe, it, expect, vi } from "vitest";
import { copyText } from "../../apps/desktop/src/lib/clipboard";

const TEXT = "MADSCOPE WEBSITE INSPECTION REPORT\n…long report body…";

describe("copyText", () => {
  it("succeeds through the async Clipboard API and passes the exact text", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    const result = await copyText(TEXT, { writeText, execCopy: null });
    expect(result).toEqual({ ok: true, method: "clipboard-api" });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it("falls back to execCommand when the Clipboard API rejects", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("NotAllowedError: permission denied");
    });
    const execCopy = vi.fn(() => true);
    const result = await copyText(TEXT, { writeText, execCopy });
    expect(result).toEqual({ ok: true, method: "fallback" });
    expect(execCopy).toHaveBeenCalledWith(TEXT);
  });

  it("falls back when no async Clipboard API is available", async () => {
    const execCopy = vi.fn(() => true);
    const result = await copyText(TEXT, { writeText: null, execCopy });
    expect(result).toEqual({ ok: true, method: "fallback" });
    expect(execCopy).toHaveBeenCalledWith(TEXT);
  });

  it("reports failure when both mechanisms fail, with the original error", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("denied by policy");
    });
    const execCopy = vi.fn(() => false);
    const result = await copyText(TEXT, { writeText, execCopy });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("denied by policy");
      expect(result.error).toContain("fallback");
    }
  });

  it("reports failure when the fallback throws", async () => {
    const result = await copyText(TEXT, {
      writeText: null,
      execCopy: () => {
        throw new Error("execCommand exploded");
      },
    });
    expect(result).toEqual({ ok: false, error: "execCommand exploded" });
  });

  it("reports failure when no mechanism exists instead of claiming success", async () => {
    const result = await copyText(TEXT, { writeText: null, execCopy: null });
    expect(result).toEqual({
      ok: false,
      error: "no clipboard mechanism is available here",
    });
  });

  it("never reports success before the operation resolves", async () => {
    let resolved = false;
    const writeText = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      resolved = true;
    });
    const promise = copyText(TEXT, { writeText, execCopy: null });
    const immediate = await promise;
    expect(resolved).toBe(true);
    expect(immediate.ok).toBe(true);
  });
});
