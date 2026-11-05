import { describe, expect, it } from "vitest";
import {
  arrowStop,
  axisDeltoid,
  axisRailX,
  axisRailY,
  mathLabel,
  resolvedLabel,
} from "./chrome-arrow.ts";

describe("axisRail", () => {
  it("spans the figure box, not the contain content", () => {
    const box = { x: 10, y: 4, w: 80, h: 40 };
    expect(axisRailX(box, 24)).toEqual({
      tail: [10, 24],
      tip: [90, 24],
    });
    expect(axisRailY(box, 50)).toEqual({
      tail: [50, 44],
      tip: [50, 4],
    });
  });
});

describe("mathLabel", () => {
  it("wraps a letter so texSource keeps math italic", () => {
    expect(mathLabel("x")).toBe("$x$");
    expect(mathLabel("$O$")).toBe("$O$");
    expect(mathLabel("\\theta")).toBe("\\theta");
  });
});

describe("resolvedLabel", () => {
  it("uses the fallback and hides an empty string", () => {
    expect(resolvedLabel(undefined, "$x$")).toBe("$x$");
    expect(resolvedLabel("", "$x$")).toBeUndefined();
    expect(resolvedLabel("t", "$x$")).toBe("$t$");
  });
});

describe("axisDeltoid", () => {
  it("builds a stealth tip with side pinches and a notch toward the tip", () => {
    const mark = axisDeltoid([10, 5], [0, 5], "#111111");
    expect(mark?.op).toBe("polygon");
    if (mark && mark.op === "polygon") {
      const [tip, leftMid, left, notch, right, rightMid] = mark.points;
      expect(mark.points).toHaveLength(6);
      expect(tip).toEqual([10, 5]);
      expect(left?.[0]).toBeCloseTo(right?.[0] ?? 0);
      expect(notch?.[0]).toBeGreaterThan(left?.[0] ?? 0);
      expect(notch?.[0]).toBeLessThan(10);
      /* 옆점은 tip-어깨 중점보다 중심선(y=5)에 가깝다. */
      expect(Math.abs((leftMid?.[1] ?? 0) - 5)).toBeLessThan(
        Math.abs(((tip[1] + (left?.[1] ?? 5)) / 2) - 5),
      );
      expect(Math.abs((rightMid?.[1] ?? 0) - 5)).toBeLessThan(
        Math.abs(((tip[1] + (right?.[1] ?? 5)) / 2) - 5),
      );
      expect(mark.fill).toBe("#111111");
      expect(mark.stroke).toBe("none");
    }
    expect(arrowStop([10, 5], [0, 5])?.[0]).toBeCloseTo(
      mark && mark.op === "polygon" ? mark.points[3]![0] : 0,
    );
  });
});
