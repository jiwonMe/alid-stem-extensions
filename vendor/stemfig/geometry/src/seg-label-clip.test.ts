/**
 * 호 점선 ↔ 글자 상자. fixture 없이 페이지 mm.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE, measureLabelMm } from "@stemfig/display";
import { arcLabelBaselineAt, bowApex } from "./arc-label-pos.ts";
import { clipPolyOutside, labelClipRect } from "./seg-label-clip.ts";
import { SEG_ARC_GAP_PAD_MM, segmentBow } from "./seg-label-arc.ts";

describe("clipPolyOutside", () => {
  it("drops bow samples that sit inside the label box", () => {
    const bow = segmentBow({ x: 0, y: 0 }, { x: 12, y: 0 })!;
    const size = DEFAULT_STYLE.textSize;
    const at = arcLabelBaselineAt(bowApex(bow), "4", size);
    const rect = labelClipRect(at, "4", size)!;
    const runs = clipPolyOutside(bow, rect);
    expect(runs.length).toBeGreaterThanOrEqual(2);
    for (const run of runs) {
      for (const p of run) {
        expect(inside(p, rect)).toBe(false);
      }
    }
  });

  it("keeps the whole bow when the box misses the arc", () => {
    const bow = segmentBow({ x: 0, y: 0 }, { x: 12, y: 0 })!;
    const runs = clipPolyOutside(bow, { x: 40, y: 40, w: 2, h: 2 });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(bow.length);
  });

  it("pads the MathJax box so dashes do not kiss the ink", () => {
    const size = DEFAULT_STYLE.textSize;
    const box = measureLabelMm("4", size);
    const rect = labelClipRect({ x: 0, y: 0 }, "4", size)!;
    expect(rect.w).toBeCloseTo(box.w + SEG_ARC_GAP_PAD_MM * 2);
    expect(rect.h).toBeCloseTo(box.h + SEG_ARC_GAP_PAD_MM * 2);
  });
});

function inside(
  p: { x: number; y: number },
  r: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    p.x > r.x + 1e-6 &&
    p.x < r.x + r.w - 1e-6 &&
    p.y > r.y + 1e-6 &&
    p.y < r.y + r.h - 1e-6
  );
}
