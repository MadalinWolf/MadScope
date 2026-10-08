import type { LayoutSnapshot } from "@madscope/browser";
import type { ViewportConfig } from "@madscope/shared";

export type IssueSeverity = "low" | "medium" | "high";
export type IssueType =
  | "horizontal-overflow"
  | "element-overflow"
  | "text-clipping"
  | "image-overflow"
  | "small-touch-target"
  | "overlapping-elements"
  | "offscreen-element";

export type ResponsiveIssue = {
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  selector?: string;
  viewport: string;
  evidence?: string;
};

export type HealthScore = {
  score: number;
  maxScore: number;
  issues: ResponsiveIssue[];
  breakdown: Array<{ type: IssueType; count: number; penalty: number }>;
};

/**
 * Deterministic scoring. Starts at 100 and subtracts fixed penalties:
 * - horizontal-overflow: 15 (high)
 * - element-overflow: 4 each, max 20
 * - image-overflow: 3 each, max 12
 * - text-clipping: 2 each, max 10
 * - small-touch-target: 1 each, max 10
 * - overlapping-elements: 3 each, max 15
 * - offscreen-element: 2 each, max 10
 * Floor of 0. Documented in docs/scoring.md.
 */
const PENALTIES: Record<IssueType, { per: number; max: number }> = {
  "horizontal-overflow": { per: 15, max: 15 },
  "element-overflow": { per: 4, max: 20 },
  "image-overflow": { per: 3, max: 12 },
  "text-clipping": { per: 2, max: 10 },
  "small-touch-target": { per: 1, max: 10 },
  "overlapping-elements": { per: 3, max: 15 },
  "offscreen-element": { per: 2, max: 10 },
};

export function detectIssues(
  layout: LayoutSnapshot,
  viewport: ViewportConfig,
): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  const label = `${viewport.name} ${viewport.width}×${viewport.height}`;

  if (layout.scrollWidth > viewport.width + 1) {
    issues.push({
      type: "horizontal-overflow",
      severity: "high",
      message: `MadScope detected a possible layout problem: page scrolls horizontally (${layout.scrollWidth}px vs viewport ${viewport.width}px).`,
      viewport: label,
      evidence: `scrollWidth=${layout.scrollWidth}, viewportWidth=${viewport.width}`,
    });
  }

  for (const o of layout.overflowing.slice(0, 10)) {
    issues.push({
      type: "element-overflow",
      severity: "medium",
      message: `Potential issue: element may extend outside the viewport.`,
      selector: o.selector,
      viewport: label,
      evidence: `elementWidth=${o.width}, viewportWidth=${o.viewportWidth}`,
    });
  }

  for (const c of layout.clippedText.slice(0, 10)) {
    issues.push({
      type: "text-clipping",
      severity: "low",
      message: `Potential issue: text may be clipped or truncated.`,
      selector: c.selector,
      viewport: label,
      evidence: c.text.slice(0, 120),
    });
  }

  for (const img of layout.images.filter((i) => i.overflowing).slice(0, 10)) {
    issues.push({
      type: "image-overflow",
      severity: "medium",
      message: `Potential issue: image is wider than its container.`,
      selector: img.selector,
      viewport: label,
      evidence: `imageWidth=${img.width}, containerWidth=${img.containerWidth}`,
    });
  }

  for (const t of layout.touchTargets.filter((t) => t.tooSmall).slice(0, 10)) {
    issues.push({
      type: "small-touch-target",
      severity: "low",
      message: `Potential issue: interactive element "${t.label || t.selector}" is unusually small (${t.width}×${t.height}px). Aim for at least 24×24px.`,
      selector: t.selector,
      viewport: label,
      evidence: `${t.width}x${t.height}`,
    });
  }

  for (const o of layout.overlaps.slice(0, 10)) {
    issues.push({
      type: "overlapping-elements",
      severity: "medium",
      message: `Potential issue: two elements appear to overlap.`,
      selector: `${o.a} ↔ ${o.b}`,
      viewport: label,
    });
  }

  for (const o of layout.offscreen.slice(0, 10)) {
    issues.push({
      type: "offscreen-element",
      severity: "low",
      message: `Potential issue: element appears unintentionally outside the viewport.`,
      selector: o.selector,
      viewport: label,
      evidence: `left=${o.left}, right=${o.right}, viewportWidth=${o.viewportWidth}`,
    });
  }

  return issues;
}

export function scoreIssues(allIssues: ResponsiveIssue[][]): HealthScore {
  const flat = allIssues.flat();
  const byType = new Map<IssueType, number>();
  for (const i of flat) byType.set(i.type, (byType.get(i.type) ?? 0) + 1);
  let score = 100;
  const breakdown: HealthScore["breakdown"] = [];
  for (const [type, rule] of Object.entries(PENALTIES) as Array<
    [IssueType, { per: number; max: number }]
  >) {
    const count = byType.get(type) ?? 0;
    const penalty = Math.min(count * rule.per, rule.max);
    score -= penalty;
    breakdown.push({ type, count, penalty });
  }
  score = Math.max(0, Math.min(100, score));
  return { score, maxScore: 100, issues: flat, breakdown };
}
