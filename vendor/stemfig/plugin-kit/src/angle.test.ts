/**
 * 각도 격자와 도 라벨은 플러그인마다 다시 만들지 않는다.
 */
import { describe, expect, it } from "vitest";
import { degreeTex, snapDegrees } from "./angle.ts";
import { shorterSweep } from "./arc.ts";
import { splitDash } from "./dash.ts";

describe("snapDegrees", () => {
  it("snaps to the nearest step and keeps a straight angle positive", () => {
    expect(snapDegrees(37, 15)).toBe(30);
    expect(snapDegrees(38, 15)).toBe(45);
    expect(snapDegrees(180, 15)).toBe(180);
    expect(snapDegrees(-180, 15)).toBe(180);
  });
});

describe("degreeTex", () => {
  it("wraps a rounded degree so the glyph is a TeX circ", () => {
    expect(degreeTex(60.2)).toBe("$60^{\\circ}$");
    expect(degreeTex(-15)).toBe("$-15^{\\circ}$");
  });
});

describe("shorterSweep", () => {
  it("picks the turn that stays within half a circle", () => {
    expect(shorterSweep(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(shorterSweep(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
  });
});

describe("splitDash", () => {
  it("carries the phase across a vertex", () => {
    const parts = splitDash([[0, 0], [1.2, 0], [1.2, 1.2]], 1.2, 0.8);
    expect(parts[0]).toEqual([[0, 0], [1.2, 0]]);
    expect(parts[1]?.[0]?.[1]).toBeCloseTo(0.8);
  });
});
