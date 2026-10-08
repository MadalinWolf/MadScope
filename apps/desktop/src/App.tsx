import { useCallback, useEffect, useMemo, useState } from "react";
import { validateUrl, VIEWPORT_PRESETS } from "@madscope/shared";

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

const DEFAULT_SELECTED = ["mobile", "tablet", "desktop"];

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCompare(null);
      }
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "r" || e.key === "R") void runScan();
      if (e.key === "s" || e.key === "S") void runScan();
      if (e.key === "b" || e.key === "B") void runBaseline();
      if (e.key === "t" || e.key === "T") void runTest();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runScan, runBaseline, runTest]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800 bg-neutral-900/60">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded bg-sky-500 font-bold text-neutral-950"
            aria-hidden="true"
          >
            M
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">MadScope</h1>
            <p className="text-xs text-neutral-400">
              Local-first responsive testing
            </p>
          </div>
          <div className="ml-auto text-xs text-neutral-400">
            No account · No telemetry · Screenshots stay local
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section
          aria-label="URL and viewports"
          className="rounded border border-neutral-800 bg-neutral-900 p-4"
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
                className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "url-error" : undefined}
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-sky-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
              >
                {loading ? "Rendering…" : "Render (R)"}
              </button>
            </div>
            {error && (
              <p id="url-error" role="alert" className="text-sm text-red-400">
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
                  className="flex cursor-pointer items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-2 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(vp.id)}
                    onChange={() => toggle(vp.id)}
                    className="h-4 w-4 accent-sky-500"
                  />
                  <span>
                    <span className="block font-medium">{vp.name}</span>
                    <span className="block text-xs text-neutral-400">
                      {vp.width}×{vp.height}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="cw" className="block text-xs text-neutral-400">
                  Width
                </label>
                <input
                  id="cw"
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  className="w-24 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label htmlFor="ch" className="block text-xs text-neutral-400">
                  Height
                </label>
                <input
                  id="ch"
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  className="w-24 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
                  inputMode="numeric"
                />
              </div>
              <button
                type="button"
                onClick={addCustom}
                className="rounded border border-neutral-700 px-3 py-1 text-sm"
              >
                Add custom
              </button>
            </div>
          </div>
        </section>

        {scan && (
          <section aria-label="Results" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded border border-neutral-800 bg-neutral-900 p-4">
              <div>
                <h2 className="text-sm font-medium">Responsive Health</h2>
                <p className="text-2xl font-bold" aria-live="polite">
                  {scan.health.score} / 100
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => void runBaseline()}
                  disabled={loading}
                  className="rounded border border-neutral-700 px-3 py-1.5 text-sm"
                >
                  Create baseline (B)
                </button>
                <button
                  onClick={() => void runTest()}
                  disabled={loading}
                  className="rounded border border-neutral-700 px-3 py-1.5 text-sm"
                >
                  Run visual test (T)
                </button>
              </div>
            </div>
            {testReport && (
              <pre className="whitespace-pre-wrap rounded border border-neutral-800 bg-neutral-900 p-4 text-sm">
                {testReport}
              </pre>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {scan.results.map((r) => (
                <article
                  key={r.viewport.id}
                  className="overflow-hidden rounded border border-neutral-800 bg-neutral-900"
                >
                  <header className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {r.viewport.name}
                      </h3>
                      <p className="text-xs text-neutral-400">
                        {r.viewport.width}×{r.viewport.height} · {r.loadTimeMs}
                        ms
                      </p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${r.issues.length === 0 ? "bg-emerald-900 text-emerald-200" : "bg-amber-900 text-amber-200"}`}
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
                    <p className="p-3 text-sm text-neutral-400">
                      Screenshot saved: {r.screenshot.screenshotPath}
                    </p>
                  )}
                  <div className="space-y-1 px-3 py-2">
                    {r.issues.length === 0 && (
                      <p className="text-xs text-neutral-400">
                        No potential issues detected.
                      </p>
                    )}
                    {r.issues.slice(0, 5).map((i, idx) => (
                      <p key={idx} className="text-xs text-neutral-300">
                        <span className="font-medium text-amber-300">
                          [{i.severity}] {i.type}:
                        </span>{" "}
                        {i.message}{" "}
                        {i.selector && (
                          <span className="text-neutral-500">
                            ({i.selector})
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            {scan.results.length >= 2 && (
              <div className="rounded border border-neutral-800 bg-neutral-900 p-4">
                <h2 className="text-sm font-medium">Compare screenshots</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {scan.results.map((r) => (
                    <button
                      key={r.viewport.id}
                      className="rounded border border-neutral-700 px-2 py-1 text-xs"
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
                    <p className="text-xs text-neutral-400">
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
                        className="relative mt-2 overflow-hidden border border-neutral-700"
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
                        className="relative mt-2 overflow-hidden border border-neutral-700"
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
          className="rounded border border-neutral-800 bg-neutral-900 p-4"
        >
          <h2 className="text-sm font-medium">Breakpoint ruler</h2>
          <div
            className="relative mt-3 h-8 rounded bg-neutral-950"
            role="img"
            aria-label="Common breakpoints: 320, 390, 430, 768, 1024, 1280, 1440, 1920 pixels"
          >
            {[320, 390, 430, 768, 1024, 1280, 1440, 1920].map((w) => (
              <div
                key={w}
                className="absolute top-0 h-full border-l border-sky-800"
                style={{ left: `${(w / 2000) * 100}%` }}
              >
                <span className="ml-1 text-[10px] text-neutral-400">{w}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Ruler shows common breakpoints. Interactive editing is planned.
          </p>
        </section>

        <footer className="text-xs text-neutral-500">
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
