/**
 * Plain-text inspection report builder.
 *
 * Produces a report that can be pasted straight into an AI coding agent.
 * Only fields that are actually known are emitted — the MadScope engine is a
 * responsive layout detector, so there is no browser/runtime line, no script
 * stack traces and no network diagnostics to invent. The `Diagnostics source`
 * line states that scope explicitly.
 */

export type ReportIssue = {
  type: string;
  severity: string;
  message: string;
  selector?: string;
  viewport: string;
  evidence?: string;
};

export type ReportViewport = {
  name: string;
  width: number;
  height: number;
  /** Preset category (mobile/tablet/desktop) or "custom" when known. */
  profile?: string;
  /** Engine-recorded inspection timestamp, when available. */
  timestamp?: string;
  issues: ReportIssue[];
};

export type InspectionReportInput = {
  url: string;
  viewports: ReportViewport[];
  health?: { score: number; maxScore: number };
};

/** Total diagnostics across all viewports — must match emitted entries. */
export function countDiagnostics(
  viewports: ReadonlyArray<Pick<ReportViewport, "issues">>,
): number {
  return viewports.reduce((total, v) => total + v.issues.length, 0);
}

/** One diagnostic entry. `index` adds the `[n]` prefix used in full reports. */
export function formatIssue(issue: ReportIssue, index?: number): string {
  const lines: string[] = [
    index === undefined
      ? `Type: ${issue.type}`
      : `[${index}] Type: ${issue.type}`,
    `Severity: ${issue.severity}`,
    `Message: ${issue.message}`,
    `Viewport: ${issue.viewport}`,
  ];
  if (issue.selector) lines.push(`Selector: ${issue.selector}`);
  if (issue.evidence) lines.push(`Evidence: ${issue.evidence}`);
  return lines.join("\n");
}

/** Numbered, blank-line-separated entries for a list of diagnostics. */
export function formatIssueEntries(issues: readonly ReportIssue[]): string {
  return issues.map((issue, i) => formatIssue(issue, i + 1)).join("\n\n");
}

export function buildInspectionReport(input: InspectionReportInput): string {
  const lines: string[] = ["MADSCOPE WEBSITE INSPECTION REPORT", ""];
  lines.push(`Inspected URL: ${input.url}`);

  const { viewports } = input;
  if (viewports.length > 0) {
    const dimensions = [
      ...new Set(viewports.map((v) => `${v.width} × ${v.height}`)),
    ];
    lines.push(`Viewport: ${dimensions.join(", ")}`);

    const profiles = [
      ...new Set(
        viewports.map((v) => v.profile).filter((p): p is string => !!p),
      ),
    ];
    if (profiles.length > 0)
      lines.push(`Device/profile: ${profiles.join(", ")}`);

    const firstTimestamp = viewports
      .map((v) => v.timestamp)
      .find((t): t is string => !!t);
    if (firstTimestamp) lines.push(`Timestamp: ${firstTimestamp}`);
  }
  if (input.health) {
    lines.push(
      `Health score: ${input.health.score} / ${input.health.maxScore}`,
    );
  }
  lines.push(
    "Diagnostics source: MadScope responsive issue detector (layout diagnostics)",
  );
  lines.push("", "SUMMARY");

  const total = countDiagnostics(viewports);
  lines.push(`Total reported diagnostics: ${total}`);
  lines.push("", "ERRORS", "");

  if (total === 0) {
    lines.push(
      "None reported. The inspection completed without diagnostics from the MadScope engine.",
    );
  } else {
    const issues = viewports.flatMap((v) => v.issues);
    lines.push(formatIssueEntries(issues));
  }

  lines.push("", "END OF REPORT");
  return lines.join("\n");
}
