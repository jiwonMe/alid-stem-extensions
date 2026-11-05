/**
 * 변 라벨 호. fixture 없이 페이지 mm.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE, measureLabelMm } from "@stemfig/display";
import {
  arcLabelBaseline,
  dashPoly,
  labelGapMm,
  SEG_ARC_CHAR_EM,
  SEG_ARC_DASH_OFF_MM,
  SEG_ARC_DASH_ON_MM,
  SEG_ARC_GAP_PAD_MM,
  SEG_ARC_SAGITTA_MM,
  segmentBow,
  splitBow,
} from "./seg-label-arc.ts";

describe("segment label arc", () => {
  it("starts at A and ends at B", () => {
    const bow = segmentBow({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(bow).toBeDefined();
    expect(bow![0]!.x).toBeCloseTo(0);
    expect(bow![0]!.y).toBeCloseTo(0);
    expect(bow![bow!.length - 1]!.x).toBeCloseTo(10);
    expect(bow![bow!.length - 1]!.y).toBeCloseTo(0);
    const mid = bow![Math.floor(bow!.length / 2)]!;
    expect(mid.y).toBeCloseTo(SEG_ARC_SAGITTA_MM, 1);
  });

  it("flips the bow when side is right and honors distance", () => {
    const left = segmentBow({ x: 0, y: 0 }, { x: 10, y: 0 }, 2, "left")!;
    const right = segmentBow({ x: 0, y: 0 }, { x: 10, y: 0 }, 2, "right")!;
    const lm = left[Math.floor(left.length / 2)]!;
    const rm = right[Math.floor(right.length / 2)]!;
    expect(lm.y).toBeCloseTo(2, 1);
    expect(rm.y).toBeCloseTo(-2, 1);
  });

  it("opens a gap for the label and dashes both sides", () => {
    const bow = segmentBow({ x: 0, y: 0 }, { x: 12, y: 0 })!;
    const parts = splitBow(bow, labelGapMm("AB", 3.2));
    expect(parts?.left.length).toBeGreaterThan(1);
    expect(parts?.right.length).toBeGreaterThan(1);
    const dashes = [...dashPoly(parts!.left), ...dashPoly(parts!.right)];
    expect(dashes.length).toBeGreaterThan(2);
    expect(SEG_ARC_DASH_ON_MM + SEG_ARC_DASH_OFF_MM).toBeLessThan(1);
  });

  it("opens a gap from the MathJax box, not charCount times em", () => {
    const size = DEFAULT_STYLE.textSize;
    const box = measureLabelMm("4", size);
    expect(labelGapMm("4", size)).toBeCloseTo(box.w + SEG_ARC_GAP_PAD_MM * 2);
    expect(labelGapMm("4", size)).toBeLessThan(
      1 * size * SEG_ARC_CHAR_EM + SEG_ARC_GAP_PAD_MM * 2,
    );
    const at = { x: 10, y: 20 };
    const base = arcLabelBaseline(at, "4", size);
    expect(base.x).toBeCloseTo(at.x - (box.x + box.w / 2));
    expect(base.y).toBeCloseTo(at.y - (box.y + box.h / 2));
  });
});
