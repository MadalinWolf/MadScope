import { describe, it, expect } from "vitest";
import { detectIssues, scoreIssues } from "@madscope/issue-detector";
import type { LayoutSnapshot } from "@madscope/browser";

const vp = { id: "mobile", name: "Mobile", width: 390, height: 844 };

function layout(over: Partial<LayoutSnapshot>): LayoutSnapshot {
  return {
    scrollWidth: 390,
    clientWidth: 390,
    scrollHeight: 800,
    overflowing: [],
    images: [],
    touchTargets: [],
    overlaps: [],
    offscreen: [],
    clippedText: [],
    ...over,
  };
}

describe("issue detector", () => {
  it("flags horizontal overflow", () => {
    const issues = detectIssues(layout({ scrollWidth: 1200 }), vp);
    expect(issues.some((i) => i.type === "horizontal-overflow")).toBe(true);
  });
  it("is clean for a good page", () => {
    expect(detectIssues(layout({}), vp)).toHaveLength(0);
  });
  it("flags small touch targets and clipped text", () => {
    const issues = detectIssues(
      layout({
        touchTargets: [
          {
            selector: "button",
            label: "x",
            width: 10,
            height: 10,
            tooSmall: true,
          },
        ],
        clippedText: [{ selector: "p", text: "long..." }],
      }),
      vp,
    );
    expect(issues.some((i) => i.type === "small-touch-target")).toBe(true);
    expect(issues.some((i) => i.type === "text-clipping")).toBe(true);
  });
  it("scores deterministically", () => {
    const a = scoreIssues([
      [detectIssues(layout({ scrollWidth: 1200 }), vp)].flat(),
    ]);
    const b = scoreIssues([
      [detectIssues(layout({ scrollWidth: 1200 }), vp)].flat(),
    ]);
    expect(a.score).toBe(b.score);
    expect(a.score).toBeLessThan(100);
    expect(scoreIssues([[]]).score).toBe(100);
  });
});
