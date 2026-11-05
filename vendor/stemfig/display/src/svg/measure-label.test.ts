import { describe, expect, it } from "vitest";
import { latexToSvg, texSource } from "./latex.ts";
import { measureLabelMm } from "./measure-label.ts";

describe("measureLabelMm", () => {
  it("matches MathJax width and height for a roman A", () => {
    const built = latexToSvg(texSource("A"), 3.2, "#000000");
    const box = measureLabelMm("A", 3.2);
    expect(built).toBeDefined();
    expect(box.w).toBeCloseTo(built!.width);
    expect(box.h).toBeCloseTo(built!.height);
    expect(box.y).toBeCloseTo(-(built!.height + built!.valign));
    expect(box.w).toBeGreaterThan(1);
    expect(box.w).toBeLessThan(3.2);
  });

  it("makes ABCD wider than A, not 4× a sans em", () => {
    const a = measureLabelMm("A", 3.2);
    const long = measureLabelMm("ABCD", 3.2);
    expect(long.w).toBeGreaterThan(a.w * 2.5);
    expect(long.w).not.toBeCloseTo(4 * 3.2 * 0.58, 1);
  });

  it("falls back for hangul that Computer Modern cannot draw", () => {
    const box = measureLabelMm("가", 3.2);
    expect(box.w).toBeCloseTo(3.2);
    expect(box.h).toBeCloseTo(3.2);
  });

  it("estimates mixed Korean labels with full-em syllables and Latin average widths", () => {
    expect(measureLabelMm("A 구간", 3).w).toBeCloseTo((0.58 * 2 + 2) * 3);
    expect(measureLabelMm("지면", 3).w).toBeCloseTo(6);
    expect(measureLabelMm("日本語", 3).w).toBeCloseTo(9);
  });

  it("normalizes decomposed Hangul and does not add width for combining marks", () => {
    expect(measureLabelMm("가".normalize("NFD"), 3).w).toBeCloseTo(3);
    expect(measureLabelMm("a\u0301한", 3).w).toBeCloseTo((0.58 + 1) * 3);
  });
});
