import { describe, it, expect } from "vitest";
import {
  buildInspectionReport,
  countDiagnostics,
  formatIssue,
  formatIssueEntries,
  type ReportIssue,
} from "../../apps/desktop/src/lib/report";

const issue = (over: Partial<ReportIssue> = {}): ReportIssue => ({
  type: "horizontal-overflow",
  severity: "high",
  message: "Document scrolls horizontally: 412px content in 390px viewport.",
  viewport: "Mobile 390×844",
  ...over,
});

describe("buildInspectionReport", () => {
  it("includes the real URL, viewport dimensions, profile and timestamp", () => {
    const report = buildInspectionReport({
      url: "https://madwolfstudios.com/projects/madscope/",
      viewports: [
        {
          name: "Mobile",
          width: 390,
          height: 844,
          profile: "mobile",
          timestamp: "2026-10-09T12:00:00.000Z",
          issues: [],
        },
      ],
      health: { score: 85, maxScore: 100 },
    });

    expect(report).toContain(
      "Inspected URL: https://madwolfstudios.com/projects/madscope/",
    );
    expect(report).toContain("Viewport: 390 × 844");
    expect(report).toContain("Device/profile: mobile");
    expect(report).toContain("Timestamp: 2026-10-09T12:00:00.000Z");
    expect(report).toContain("Health score: 85 / 100");
    expect(report.startsWith("MADSCOPE WEBSITE INSPECTION REPORT")).toBe(true);
    expect(report.trimEnd().endsWith("END OF REPORT")).toBe(true);
  });

  it("lists every scanned viewport's dimensions when several are inspected", () => {
    const report = buildInspectionReport({
      url: "https://example.com/",
      viewports: [
        {
          name: "Mobile",
          width: 390,
          height: 844,
          profile: "mobile",
          issues: [],
        },
        {
          name: "Tablet",
          width: 768,
          height: 1024,
          profile: "tablet",
          issues: [],
        },
        {
          name: "Desktop",
          width: 1440,
          height: 900,
          profile: "desktop",
          issues: [],
        },
      ],
    });
    expect(report).toContain("Viewport: 390 × 844, 768 × 1024, 1440 × 900");
    expect(report).toContain("Device/profile: mobile, tablet, desktop");
  });

  it("emits every diagnostic exactly once with a summary that matches", () => {
    const issues = [
      issue(),
      issue({
        type: "text-clipping",
        severity: "medium",
        message: "Label clipped.",
      }),
      issue({
        type: "small-touch-target",
        severity: "low",
        message: "12×12px target.",
      }),
      issue({
        type: "element-overflow",
        severity: "high",
        message: "Card wider than container.",
      }),
    ];
    const report = buildInspectionReport({
      url: "https://example.com/",
      viewports: [
        { name: "Mobile", width: 390, height: 844, issues: issues.slice(0, 3) },
        { name: "Desktop", width: 1440, height: 900, issues: issues.slice(3) },
      ],
    });

    const totalLine = report
      .split("\n")
      .find((l) => l.startsWith("Total reported diagnostics:"));
    expect(totalLine).toBe("Total reported diagnostics: 4");

    const entryMarkers = report.match(/^\[\d+\] Type:.*$/gm) ?? [];
    expect(entryMarkers).toHaveLength(4);
    expect(entryMarkers).toEqual([
      "[1] Type: horizontal-overflow",
      "[2] Type: text-clipping",
      "[3] Type: small-touch-target",
      "[4] Type: element-overflow",
    ]);
    // every message appears verbatim
    for (const i of issues) expect(report).toContain(i.message);
  });

  it("preserves actual severity labels instead of calling everything an error", () => {
    const report = buildInspectionReport({
      url: "https://example.com/",
      viewports: [
        {
          name: "Mobile",
          width: 390,
          height: 844,
          issues: [
            issue({ severity: "low" }),
            issue({ severity: "medium" }),
            issue({ severity: "high" }),
          ],
        },
      ],
    });
    expect(report).toContain("Severity: low");
    expect(report).toContain("Severity: medium");
    expect(report).toContain("Severity: high");
  });

  it("includes selector and evidence only when the engine provided them", () => {
    const report = buildInspectionReport({
      url: "https://example.com/",
      viewports: [
        {
          name: "Mobile",
          width: 390,
          height: 844,
          issues: [
            issue({
              selector: ".hero > .title",
              evidence: "scrollWidth=412 viewportWidth=390",
            }),
            issue({ type: "image-overflow" }),
          ],
        },
      ],
    });
    expect(report).toContain("Selector: .hero > .title");
    expect(report).toContain("Evidence: scrollWidth=412 viewportWidth=390");
    // second entry has no selector/evidence lines directly after its viewport
    const secondEntry = (
      report.split("[2] Type: image-overflow")[1] ?? ""
    ).trimStart();
    expect(secondEntry.startsWith("Severity:")).toBe(true);
  });

  it("stays useful with zero diagnostics and never invents fields", () => {
    const report = buildInspectionReport({
      url: "https://example.com/",
      viewports: [{ name: "Mobile", width: 390, height: 844, issues: [] }],
    });
    expect(report).toContain("Total reported diagnostics: 0");
    expect(report).toContain("None reported.");
    expect(report.trimEnd().endsWith("END OF REPORT")).toBe(true);
    // fields the engine cannot know must never appear
    expect(report).not.toContain("Browser/runtime:");
    expect(report).not.toContain("undefined");
    expect(report).not.toContain("[1] Type:");
  });

  it("omits timestamp, profile and health lines when not available", () => {
    const report = buildInspectionReport({
      url: "https://example.com/",
      viewports: [
        { name: "Custom 800×600", width: 800, height: 600, issues: [] },
      ],
    });
    expect(report).not.toContain("Timestamp:");
    expect(report).not.toContain("Device/profile:");
    expect(report).not.toContain("Health score:");
  });

  it("states the diagnostics scope honestly", () => {
    const report = buildInspectionReport({
      url: "https://example.com/",
      viewports: [],
    });
    expect(report).toContain(
      "Diagnostics source: MadScope responsive issue detector (layout diagnostics)",
    );
  });
});

describe("countDiagnostics", () => {
  it("sums issues across viewports", () => {
    expect(
      countDiagnostics([
        { issues: [issue(), issue()] },
        { issues: [] },
        { issues: [issue()] },
      ]),
    ).toBe(3);
    expect(countDiagnostics([])).toBe(0);
  });
});

describe("formatIssue", () => {
  it("prefixes the index only when given", () => {
    expect(formatIssue(issue(), 2).startsWith("[2] Type:")).toBe(true);
    expect(formatIssue(issue()).startsWith("Type:")).toBe(true);
  });

  it("keeps the message verbatim, including long URLs", () => {
    const message =
      "Broken link: https://example.com/very/long/path/that/keeps/going/and/going?query=1";
    expect(formatIssue(issue({ message }))).toContain(message);
  });
});

describe("formatIssueEntries", () => {
  it("numbers entries sequentially across the list", () => {
    const text = formatIssueEntries([
      issue({ type: "a" }),
      issue({ type: "b" }),
      issue({ type: "c" }),
    ]);
    const markers = text.match(/^\[\d+\] /gm) ?? [];
    expect(markers).toEqual(["[1] ", "[2] ", "[3] "]);
    expect(text.split("\n\n")).toHaveLength(3);
  });

  it("returns an empty string for no issues", () => {
    expect(formatIssueEntries([])).toBe("");
  });
});
