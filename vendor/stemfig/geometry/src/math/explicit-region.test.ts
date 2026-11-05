/**
 * 체제 분류 단위 테스트. sampleExplicit 을 거치지 않고 규칙만 본다.
 * 화면은 560px 폭 [-1,1] — 1px = 1/280 단위.
 */
import { describe, expect, it } from "vitest";
import { classifyRegions, hysteresis } from "./explicit-region.ts";
import { RES, alignedEdges, screenMap } from "./explicit-screen.ts";

const box = { xmin: -1, xmax: 1, ymin: -1, ymax: 1 };
const screen = screenMap(box, 560)!;

describe("hysteresis", () => {
  it("marks strong cells and the candidate run attached to them", () => {
    /* 강한 칸(2) 하나에 후보(합 ≥ 3) 이웃이 붙어 있으면 그 연속 구간 전체가 띠다. */
    expect(hysteresis([0, 1, 2, 1, 0])).toEqual([false, true, true, true, false]);
  });

  it("leaves candidate-only runs as curve", () => {
    /* 1,1,1 은 합이 3 이라 후보지만 강한 칸이 없어 곡선으로 남는다(주기 3~4px 균일 진동). */
    expect(hysteresis([1, 1, 1, 1])).toEqual([false, false, false, false]);
  });

  it("does not bridge two strong runs across a non-candidate gap", () => {
    expect(hysteresis([2, 0, 0, 2])).toEqual([true, false, false, true]);
  });
});

describe("classifyRegions", () => {
  it("keeps a smooth curve entirely as curves", () => {
    const { curves, packed } = classifyRegions((x) => x * x, -1, 1, screen);
    expect(packed).toEqual([]);
    expect(curves).toEqual([{ x0: -1, x1: 1 }]);
  });

  it("packs sin(1/x) only around the origin and covers [lo,hi] exactly once", () => {
    const { curves, packed } = classifyRegions((x) => Math.sin(1 / x), -1, 1, screen);
    expect(packed.length).toBe(1);
    const band = packed[0]!;
    expect(band.x0).toBeLessThan(0);
    expect(band.x1).toBeGreaterThan(0);
    /* 2 단계 칸 폭(0.25px) 이 넓어도 주기 ≥ 0.25px 가 되는 |x| ≈ 0.02 바깥은 곡선이다. */
    expect(band.x1 - band.x0).toBeLessThan(0.1);
    const all = [...curves, ...packed].sort((a, b) => a.x0 - b.x0);
    expect(all[0]!.x0).toBe(-1);
    expect(all[all.length - 1]!.x1).toBe(1);
    for (let i = 1; i < all.length; i += 1) {
      expect(all[i]!.x0).toBeCloseTo(all[i - 1]!.x1, 12);
    }
  });

  it("packs a full-width sub-pixel oscillation as one band", () => {
    /* 주기 2π/4000 ≈ 0.0016 = 0.44px. fineCellPx(0.25) 두 배 안이라 띠. */
    const { curves, packed } = classifyRegions((x) => Math.sin(4000 * x), -1, 1, screen);
    expect(packed.length).toBe(1);
    /* 양 끝 칸은 이웃이 하나라 후보 판정에서 빠질 수 있다. 2 단계 칸 하나(0.25px) 안이면 된다. */
    const fine = RES.fineCellPx / screen.pxPerUnitX;
    expect(packed[0]!.x0).toBeLessThanOrEqual(-1 + fine + 1e-12);
    expect(packed[0]!.x1).toBeGreaterThanOrEqual(1 - fine - 1e-12);
    const curveWidth = curves.reduce((s, c) => s + (c.x1 - c.x0), 0);
    expect(curveWidth).toBeLessThanOrEqual(2 * fine + 1e-12);
  });

  it("does not pack an isolated pole", () => {
    const { packed } = classifyRegions((x) => 1 / x, -1, 1, screen);
    expect(packed).toEqual([]);
  });
});

describe("alignedEdges", () => {
  it("returns the same interior vertices for overlapping ranges", () => {
    /* 원점 정렬이라 lo 가 달라도 안쪽 경계는 k·dx 그대로다. 팬에 정점이 흔들리지 않는 근거. */
    const a = alignedEdges(-1, 1, screen, RES.spacingPx);
    const b = alignedEdges(-0.7, 0.9, screen, RES.spacingPx);
    const inner = (edges: number[], lo: number, hi: number) =>
      edges.filter((x) => x > lo + 1e-12 && x < hi - 1e-12);
    expect(inner(a, -0.7, 0.9)).toEqual(inner(b, -0.7, 0.9));
  });

  it("keeps the range ends", () => {
    const edges = alignedEdges(-0.123, 0.456, screen, RES.cellPx);
    expect(edges[0]).toBe(-0.123);
    expect(edges[edges.length - 1]).toBe(0.456);
  });
});
