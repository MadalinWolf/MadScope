import { useCallback, useEffect, useMemo, useState } from "react";
import { getPresetById, validateUrl, VIEWPORT_PRESETS } from "@madscope/shared";
import {
  applyTheme,
  isThemeId,
  loadTheme,
  saveTheme,
  THEME_IDS,
  THEME_LABELS,
  type ThemeId,
} from "./lib/themes";
import {
  buildInspectionReport,
  formatIssue,
  formatIssueEntries,
  type ReportIssue,
} from "./lib/report";
import { copyText } from "./lib/clipboard";

type ApiViewport = { id: string; name: string; width: number; height: number };
type ScanIssue = {
  type: string;
  severity: string;
  message: string;
  selector?: string;
  viewport: string;
  evidence?: string;
};
type ScanItem = {
  viewport: ApiViewport;
  title: string;
  loadTimeMs: number;
  screenshot: { screenshotPath: string; timestamp: string };
  screenshotBase64?: string;
  issues: ScanIssue[];
};
type ScanResponse = {
  url: string;
  results: ScanItem[];
  health: { score: number; maxScore: number };
};
type CopyStatus = { kind: "ok" | "error" | "info"; message: string };
type FlatDiagnostic = { key: string; issue: ReportIssue };

const DEFAULT_SELECTED = ["mobile", "tablet", "desktop"];

// In dev the Vite proxy forwards /api to the render server. In the packaged
// app the UI is served from local files, so it talks to the bundled engine
// on 127.0.0.1 directly (the port the Tauri sidecar is started with).
const API_BASE = import.meta.env.DEV ? "" : "http://127.0.0.1:4220";

async function api<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "MadScope could not reach the local engine. If this persists, restart the app — the engine starts automatically with it.",
    );
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/** Preset category for a viewport ("mobile"/"tablet"/"desktop"), else "custom". */
function profileForViewport(vp: ApiViewport): string {
  return getPresetById(vp.id)?.category ?? "custom";
}

export default function App() {
  const [url, setUrl] = useState("https://example.com");
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED);
  const [customW, setCustomW] = useState("1440");
  const [customH, setCustomH] = useState("900");
  const [customs, setCustoms] = useState<ApiViewport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [compare, setCompare] = useState<{ a: ScanItem; b: ScanItem } | null>(
    null,
  );
  const [opacity, setOpacity] = useState(0.5);
  const [slider, setSlider] = useState(50);
  const [testReport, setTestReport] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus] = useState<CopyStatus | null>(null);
  const [rowStatus, setRowStatus] = useState<
    (CopyStatus & { key: string }) | null
  >(null);

  // The bundled engine can take a few seconds to start with the app.
  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 120000;
    const poll = async () => {
      try {
        await api<{ ok: boolean }>("/api/health");
        if (!cancelled) setEngineReady(true);
        return;
      } catch {
        // not up yet
      }
      if (!cancelled && Date.now() < deadline) {
        window.setTimeout(poll, 1000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  // Theme applies immediately (data-theme on <html>) and persists.
  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  const allViewports: ApiViewport[] = useMemo(
    () => [
      ...VIEWPORT_PRESETS.map((p) => ({
        id: p.id,
        name: p.name,
        width: p.width,
        height: p.height,
      })),
      ...customs,
    ],
    [customs],
  );

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  const addCustom = () => {
    const w = Number(customW);
    const h = Number(customH);
    if (
      !Number.isInteger(w) ||
      !Number.isInteger(h) ||
      w < 200 ||
      w > 7680 ||
      h < 200 ||
      h > 4320
    ) {
      setError(
        "Custom viewport must be integers: width 200–7680, height 200–4320.",
      );
      return;
    }
    const vp = {
      id: `custom-${w}x${h}-${Date.now().toString(36)}`,
      name: `Custom ${w}×${h}`,
      width: w,
      height: h,
    };
    setCustoms((c) => [...c, vp]);
    setSelected((s) => [...s, vp.id]);
    setError(null);
  };

  const runScan = useCallback(async () => {
    const v = validateUrl(url);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    if (selected.length === 0) {
      setError("Select at least one viewport.");
      return;
    }
    setLoading(true);
    setError(null);
    setTestReport(null);
    try {
      const payload = selected
        .map((id) => allViewports.find((x) => x.id === id))
        .filter((x): x is ApiViewport => !!x);
      const data = await api<ScanResponse>("/api/scan", {
        url: v.url,
        viewports: payload,
      });
      setScan(data);
      setSelectedIssues(new Set());
      setCopyStatus(null);
      setRowStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [url, selected, allViewports]);

  const runBaseline = useCallback(async () => {
    if (!scan) return;
    try {
      setLoading(true);
      await api("/api/baseline", {
        url: scan.url,
        viewports: scan.results.map((r) => r.viewport),
      });
      setTestReport("Baseline saved. Run Visual test to compare.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [scan]);

  const runTest = useCallback(async () => {
    if (!scan) return;
    try {
      setLoading(true);
      const report = await api<{
        passed: boolean;
        cases: Array<{
          viewport: ApiViewport;
          status: string;
          message: string;
          changeRatio?: number;
          threshold: number;
          actualBase64?: string;
          diffBase64?: string;
        }>;
      }>("/api/test", {
        url: scan.url,
        viewports: scan.results.map((r) => r.viewport),
      });
      const lines = report.cases.map((c) => {
        const icon =
          c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "?";
        const pct =
          c.changeRatio !== undefined
            ? ` (${(c.changeRatio * 100).toFixed(2)}%)`
            : "";
        return `${icon} ${c.viewport.name} ${c.viewport.width}×${c.viewport.height}${pct} — ${c.message}`;
      });
      setTestReport(lines.join("\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [scan]);

  // Every diagnostic of the current inspection, in report order, with a key
  // stable for this scan (viewport id + index). Never truncated: copying must
  // not silently omit diagnostics that the UI chose not to render.
  const flattened: FlatDiagnostic[] = useMemo(
    () =>
      scan
        ? scan.results.flatMap((r) =>
            r.issues.map((issue, idx) => ({
              key: `${r.viewport.id}#${idx}`,
              issue,
            })),
          )
        : [],
    [scan],
  );
  const totalDiagnostics = flattened.length;

  const reportText = useMemo(
    () =>
      scan
        ? buildInspectionReport({
            url: scan.url,
            health: scan.health,
            viewports: scan.results.map((r) => ({
              name: r.viewport.name,
              width: r.viewport.width,
              height: r.viewport.height,
              profile: profileForViewport(r.viewport),
              timestamp: r.screenshot?.timestamp,
              issues: r.issues,
            })),
          })
        : "",
    [scan],
  );

  // Reports success only after the clipboard operation actually resolved.
  const copyWithFeedback = useCallback(
    async (text: string, successMessage: string) => {
      setRowStatus(null);
      const result = await copyText(text);
      setCopyStatus(
        result.ok
          ? { kind: "ok", message: successMessage }
          : { kind: "error", message: `Copy failed — ${result.error}` },
      );
    },
    [],
  );

  const copyAllErrors = useCallback(() => {
    if (totalDiagnostics === 0) {
      setRowStatus(null);
      setCopyStatus({
        kind: "info",
        message: "Nothing to copy — this inspection reported no diagnostics.",
      });
      return;
    }
    const text = formatIssueEntries(flattened.map((f) => f.issue));
    const label = totalDiagnostics === 1 ? "diagnostic" : "diagnostics";
    void copyWithFeedback(text, `Copied ${totalDiagnostics} ${label}.`);
  }, [flattened, totalDiagnostics, copyWithFeedback]);

  const copySelectedErrors = useCallback(() => {
    const chosen = flattened.filter((f) => selectedIssues.has(f.key));
    if (chosen.length === 0) return;
    const text = formatIssueEntries(chosen.map((f) => f.issue));
    const label = chosen.length === 1 ? "diagnostic" : "diagnostics";
    void copyWithFeedback(text, `Copied ${chosen.length} selected ${label}.`);
  }, [flattened, selectedIssues, copyWithFeedback]);

  const copyReport = useCallback(() => {
    void copyWithFeedback(reportText, "Copied the AI-ready inspection report.");
  }, [reportText, copyWithFeedback]);

  const copyOne = useCallback(async (key: string, issue: ReportIssue) => {
    setCopyStatus(null);
    const result = await copyText(formatIssue(issue));
    if (result.ok) {
      setRowStatus({ key, kind: "ok", message: "Copied" });
      setCopyStatus({ kind: "ok", message: "Copied 1 diagnostic." });
    } else {
      setRowStatus({ key, kind: "error", message: "Copy failed" });
      setCopyStatus({
        kind: "error",
        message: `Copy failed — ${result.error}`,
      });
    }
  }, []);

  const toggleIssue = useCallback((key: string) => {
    setSelectedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCompare(null);
      }
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "r" || e.key === "R") void runScan();
      if (e.key === "s" || e.key === "S") void runScan();
      if (e.key === "b" || e.key === "B") void runBaseline();
      if (e.key === "t" || e.key === "T") void runTest();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runScan, runBaseline, runTest]);

  const statusClass =
    copyStatus?.kind === "ok"
      ? "text-sm text-ok-ink"
      : copyStatus?.kind === "error"
        ? "text-sm text-danger"
        : "text-sm text-ink-muted";

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge bg-panel/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded bg-accent font-bold text-accent-ink"
            aria-hidden="true"
          >
            M
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">MadScope</h1>
            <p className="text-xs text-ink-muted">
              Local-first responsive testing
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="theme-select" className="text-xs text-ink-muted">
                Theme
              </label>
              <select
                id="theme-select"
                value={theme}
                onChange={(e) => {
                  const next = e.target.value;
                  if (isThemeId(next)) setTheme(next);
                }}
                className="rounded border border-edge-strong bg-inset px-2 py-1 text-xs text-ink"
              >
                {THEME_IDS.map((id) => (
                  <option key={id} value={id}>
                    {THEME_LABELS[id]}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-ink-muted">
              No account · No telemetry · Screenshots stay local
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section
          aria-label="URL and viewports"
          className="panel-shadow rounded border border-edge bg-panel p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runScan();
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="url" className="text-sm font-medium">
              Website URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="url"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-tech flex-1 rounded border border-edge-strong bg-inset px-3 py-2 text-sm"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "url-error" : undefined}
              />
              <button
                type="submit"
                disabled={loading || !engineReady}
                className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
              >
                {loading ? "Rendering…" : "Render (R)"}
              </button>
            </div>
            {!engineReady && (
              <p role="status" className="text-sm text-ink-muted">
                Starting the local engine… this takes a few seconds on first
                launch.
              </p>
            )}
            {error && (
              <p id="url-error" role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </form>

          <div className="mt-4">
            <h2 className="text-sm font-medium">Viewports</h2>
            <div
              className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="group"
              aria-label="Viewport presets"
            >
              {allViewports.map((vp) => (
                <label
                  key={vp.id}
                  className="flex cursor-pointer items-center gap-2 rounded border border-edge bg-inset px-2 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(vp.id)}
                    onChange={() => toggle(vp.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span>
                    <span className="block font-medium">{vp.name}</span>
                    <span className="font-tech block text-xs text-ink-muted">
                      {vp.width}×{vp.height}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="cw" className="block text-xs text-ink-muted">
                  Width
                </label>
                <input
                  id="cw"
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  className="font-tech w-24 rounded border border-edge-strong bg-inset px-2 py-1 text-sm"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label htmlFor="ch" className="block text-xs text-ink-muted">
                  Height
                </label>
                <input
                  id="ch"
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  className="font-tech w-24 rounded border border-edge-strong bg-inset px-2 py-1 text-sm"
                  inputMode="numeric"
                />
              </div>
              <button
                type="button"
                onClick={addCustom}
                className="rounded border border-edge-strong px-3 py-1 text-sm"
              >
                Add custom
              </button>
            </div>
          </div>
        </section>

        {scan && (
          <section aria-label="Results" className="space-y-4">
            <div className="panel-shadow flex flex-wrap items-center gap-3 rounded border border-edge bg-panel p-4">
              <div>
                <h2 className="text-sm font-medium">Responsive Health</h2>
                <p className="font-tech text-2xl font-bold" aria-live="polite">
                  {scan.health.score} / 100
                </p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyAllErrors}
                  disabled={totalDiagnostics === 0}
                  className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
                >
                  Copy all errors ({totalDiagnostics})
                </button>
                <button
                  type="button"
                  onClick={copySelectedErrors}
                  disabled={selectedIssues.size === 0}
                  className="rounded border border-edge-strong px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Copy selected ({selectedIssues.size})
                </button>
                <button
                  type="button"
                  onClick={copyReport}
                  className="rounded border border-edge-strong px-3 py-1.5 text-sm"
                >
                  Copy AI report
                </button>
                <button
                  onClick={() => void runBaseline()}
                  disabled={loading}
                  className="rounded border border-edge-strong px-3 py-1.5 text-sm"
                >
                  Create baseline (B)
                </button>
                <button
                  onClick={() => void runTest()}
                  disabled={loading}
                  className="rounded border border-edge-strong px-3 py-1.5 text-sm"
                >
                  Run visual test (T)
                </button>
              </div>
            </div>
            {copyStatus && (
              <p role="status" className={statusClass}>
                {copyStatus.message}
              </p>
            )}
            {testReport && (
              <pre className="whitespace-pre-wrap break-words rounded border border-edge bg-panel p-4 font-tech text-sm">
                {testReport}
              </pre>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {scan.results.map((r) => (
                <article
                  key={r.viewport.id}
                  className="panel-shadow overflow-hidden rounded border border-edge bg-panel"
                >
                  <header className="flex items-center justify-between border-b border-edge px-3 py-2">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {r.viewport.name}
                      </h3>
                      <p className="font-tech text-xs text-ink-muted">
                        {r.viewport.width}×{r.viewport.height} · {r.loadTimeMs}
                        ms
                      </p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${r.issues.length === 0 ? "bg-ok-bg text-ok-ink" : "bg-warn-bg text-warn-ink"}`}
                    >
                      {r.issues.length === 0
                        ? "OK"
                        : `${r.issues.length} potential`}
                    </span>
                  </header>
                  {r.screenshotBase64 ? (
                    <img
                      src={`data:image/png;base64,${r.screenshotBase64}`}
                      alt={`Rendered ${scan.url} at ${r.viewport.name} ${r.viewport.width} by ${r.viewport.height}`}
                      className="block w-full bg-white"
                      loading="lazy"
                    />
                  ) : (
                    <p className="p-3 text-sm text-ink-muted">
                      Screenshot saved: {r.screenshot.screenshotPath}
                    </p>
                  )}
                  <div className="px-3 py-2">
                    {r.issues.length === 0 && (
                      <p className="text-xs text-ink-muted">
                        No potential issues detected.
                      </p>
                    )}
                    {r.issues.length > 0 && (
                      <ul className="space-y-2">
                        {r.issues.map((issue, idx) => {
                          const key = `${r.viewport.id}#${idx}`;
                          return (
                            <li key={key} className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={selectedIssues.has(key)}
                                onChange={() => toggleIssue(key)}
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                                aria-label={`Select diagnostic ${idx + 1} of ${r.issues.length} for ${r.viewport.name}`}
                              />
                              <p className="font-tech min-w-0 flex-1 break-words text-xs text-ink-soft">
                                <span className="font-medium text-warn-strong">
                                  [{issue.severity}] {issue.type}:
                                </span>{" "}
                                {issue.message}{" "}
                                {issue.selector && (
                                  <span className="text-ink-dim">
                                    ({issue.selector})
                                  </span>
                                )}
                                {issue.evidence && (
                                  <span className="block text-ink-dim">
                                    {issue.evidence}
                                  </span>
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={() => void copyOne(key, issue)}
                                className="shrink-0 rounded border border-edge-strong px-1.5 py-0.5 text-xs"
                                aria-label={`Copy diagnostic: ${issue.type} for ${r.viewport.name}`}
                              >
                                Copy
                              </button>
                              {rowStatus?.key === key && (
                                <span
                                  role="status"
                                  className={`shrink-0 text-xs ${rowStatus.kind === "ok" ? "text-ok-ink" : "text-danger"}`}
                                >
                                  {rowStatus.message}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {scan.results.length >= 2 && (
              <div className="panel-shadow rounded border border-edge bg-panel p-4">
                <h2 className="text-sm font-medium">Compare screenshots</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {scan.results.map((r) => (
                    <button
                      key={r.viewport.id}
                      className="rounded border border-edge-strong px-2 py-1 text-xs"
                      onClick={() => {
                        const others = scan.results.filter(
                          (x) => x.viewport.id !== r.viewport.id,
                        );
                        if (others[0]) setCompare({ a: r, b: others[0] });
                      }}
                    >
                      {r.viewport.name} vs …
                    </button>
                  ))}
                </div>
                {compare && (
                  <div
                    className="mt-3"
                    role="dialog"
                    aria-label="Screenshot comparison"
                  >
                    <p className="text-xs text-ink-muted">
                      {compare.a.viewport.name} ↔ {compare.b.viewport.name} ·
                      Esc to close
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {compare.a.screenshotBase64 && (
                        <img
                          src={`data:image/png;base64,${compare.a.screenshotBase64}`}
                          alt={`${compare.a.viewport.name} screenshot`}
                          className="w-full bg-white"
                        />
                      )}
                      {compare.b.screenshotBase64 && (
                        <img
                          src={`data:image/png;base64,${compare.b.screenshotBase64}`}
                          alt={`${compare.b.viewport.name} screenshot`}
                          className="w-full bg-white"
                        />
                      )}
                    </div>
                    <div className="mt-3">
                      <label className="text-xs">
                        Overlay opacity: {Math.round(opacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={opacity * 100}
                        onChange={(e) =>
                          setOpacity(Number(e.target.value) / 100)
                        }
                        className="w-full"
                        aria-label="Overlay opacity"
                      />
                      <div
                        className="relative mt-2 overflow-hidden border border-edge-strong"
                        style={{ aspectRatio: "16/9" }}
                      >
                        {compare.a.screenshotBase64 && (
                          <img
                            src={`data:image/png;base64,${compare.a.screenshotBase64}`}
                            alt=""
                            className="absolute inset-0 h-full w-full bg-white object-contain"
                          />
                        )}
                        {compare.b.screenshotBase64 && (
                          <img
                            src={`data:image/png;base64,${compare.b.screenshotBase64}`}
                            alt=""
                            className="absolute inset-0 h-full w-full bg-white object-contain"
                            style={{ opacity }}
                          />
                        )}
                      </div>
                      <label className="mt-3 block text-xs">
                        Slider: {slider}%
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={slider}
                        onChange={(e) => setSlider(Number(e.target.value))}
                        className="w-full"
                        aria-label="Comparison slider"
                      />
                      <div
                        className="relative mt-2 overflow-hidden border border-edge-strong"
                        style={{ aspectRatio: "16/9" }}
                      >
                        {compare.b.screenshotBase64 && (
                          <img
                            src={`data:image/png;base64,${compare.b.screenshotBase64}`}
                            alt=""
                            className="absolute inset-0 h-full w-full bg-white object-contain"
                          />
                        )}
                        {compare.a.screenshotBase64 && (
                          <img
                            src={`data:image/png;base64,${compare.a.screenshotBase64}`}
                            alt=""
                            className="absolute inset-0 h-full bg-white object-contain"
                            style={{
                              width: `${slider}%`,
                              objectPosition: "left",
                              maxWidth: "none",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <section
          aria-label="Breakpoint ruler"
          className="panel-shadow rounded border border-edge bg-panel p-4"
        >
          <h2 className="text-sm font-medium">Breakpoint ruler</h2>
          <div
            className="relative mt-3 h-8 rounded bg-inset"
            role="img"
            aria-label="Common breakpoints: 320, 390, 430, 768, 1024, 1280, 1440, 1920 pixels"
          >
            {[320, 390, 430, 768, 1024, 1280, 1440, 1920].map((w) => (
              <div
                key={w}
                className="absolute top-0 h-full border-l border-rule"
                style={{ left: `${(w / 2000) * 100}%` }}
              >
                <span className="font-tech ml-1 text-[10px] text-ink-muted">
                  {w}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-dim">
            Ruler shows common breakpoints. Interactive editing is planned.
          </p>
        </section>

        <footer className="text-xs text-ink-dim">
          <p>
            Shortcuts: R re-run · S screenshot · B baseline · T visual test ·
            Esc close modal. MadScope is local-first: no telemetry, screenshots
            stay on this machine.
          </p>
        </footer>
      </main>
    </div>
  );
}
