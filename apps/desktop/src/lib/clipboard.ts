/**
 * Clipboard copy with an honest result and a fallback path.
 *
 * The caller only reports success after the operation actually succeeded:
 * first the async Clipboard API, then a hidden-textarea `execCommand("copy")`
 * fallback when the async API is unavailable or its permission was denied.
 */

export type CopyMethod = "clipboard-api" | "fallback";

export type CopyResult =
  { ok: true; method: CopyMethod } | { ok: false; error: string };

/** Injectable dependencies (used by tests; defaults use the real browser). */
export type CopyDeps = {
  writeText?: ((text: string) => Promise<void>) | null;
  execCopy?: ((text: string) => boolean) | null;
};

function defaultWriteText(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return Promise.reject(new Error("the async Clipboard API is unavailable"));
  }
  return navigator.clipboard.writeText(text);
}

function defaultExecCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(area);
  return copied;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function joinErrors(primary: string | null, fallback: string): string {
  return primary ? `${primary} (fallback: ${fallback})` : fallback;
}

export async function copyText(
  text: string,
  deps: CopyDeps = {},
): Promise<CopyResult> {
  const write = "writeText" in deps ? deps.writeText : defaultWriteText;
  let writeError: string | null = null;

  if (write) {
    try {
      await write(text);
      return { ok: true, method: "clipboard-api" };
    } catch (error) {
      writeError = messageOf(error);
    }
  }

  const exec =
    "execCopy" in deps
      ? deps.execCopy
      : typeof document === "undefined"
        ? null
        : defaultExecCopy;

  if (exec) {
    try {
      if (exec(text)) return { ok: true, method: "fallback" };
    } catch (error) {
      return { ok: false, error: joinErrors(writeError, messageOf(error)) };
    }
    return {
      ok: false,
      error: joinErrors(writeError, "the browser refused clipboard access"),
    };
  }

  return {
    ok: false,
    error: writeError ?? "no clipboard mechanism is available here",
  };
}
