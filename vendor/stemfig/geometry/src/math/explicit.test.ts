import { describe, expect, it } from "vitest";
import { bandOutline } from "./explicit-envelope.ts";
import { parseFn } from "./expr.ts";
import { sampleExplicit } from "./explicit.ts";

const box = { xmin: -2, xmax: 2, ymin: -2, ymax: 2 };

function crossesZero(
  parts: { x: number; y: number }[][],
  pad = 0.02,
) {
  return parts.some((part) => {
    const xs = part.map((p) => p.x);
    return Math.min(...xs) < -pad && Math.max(...xs) > pad;
  });
}

/**
 * 현에서 곡선까지 수직 거리(단위). 세로 오차가 아니다.
 * 급한 현은 세로로 몇 px 벗어나도 눈에는 선 위다. box 가 정방이라 단위×64 = px.
 */
function chordError(
  parts: { x: number; y: number }[][],
  y: (x: number) => number,
  minAbsX: number,
) {
  let max = 0;
  for (const part of parts) {
    for (let i = 1; i < part.length; i += 1) {
      const a = part[i - 1]!;
      const b = part[i]!;
      if (Math.min(Math.abs(a.x), Math.abs(b.x)) < minAbsX) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const chord = Math.hypot(dx, dy);
      if (Math.abs(dx) < 1e-6 || chord === 0) {
        continue;
      }
      for (let k = 1; k < 6; k += 1) {
        const x = a.x + (dx * k) / 6;
        const fy = y(x);
        if (!Number.isFinite(fy)) {
          continue;
        }
        max = Math.max(max, Math.abs((x - a.x) * dy - (fy - a.y) * dx) / chord);
      }
    }
  }
  return max;
}

describe("sampleExplicit", () => {
  it("keeps y = x as one polyline without a band", () => {
    const plot = sampleExplicit((x) => x, -1, 1, box);
    expect(plot.bands).toHaveLength(0);
    expect(plot.parts).toHaveLength(1);
    expect(plot.parts[0]!.length).toBeGreaterThan(2);
  });

  it("keeps a steep line connected", () => {
    const plot = sampleExplicit((x) => 40 * x, -1, 1, box);
    expect(plot.bands).toHaveLength(0);
    expect(plot.parts).toHaveLength(1);
  });

  it("keeps y = sin(x) as one polyline", () => {
    const y = parseFn("sin(x)", "fn");
    const plot = sampleExplicit(y, -6.3, 6.3, {
      xmin: -6.3,
      xmax: 6.3,
      ymin: -2,
      ymax: 2,
    });
    expect(plot.bands).toHaveLength(0);
    expect(plot.parts).toHaveLength(1);
  });

  it("keeps a fast but resolvable sine as one polyline", () => {
    const y = parseFn("sin(20 * x)", "fn");
    const plot = sampleExplicit(y, -2, 2, box);
    expect(plot.bands).toHaveLength(0);
    expect(plot.parts).toHaveLength(1);
  });

  it("follows the outer wiggles of sin(1/x)", () => {
    const y = parseFn("sin(1/x)", "fn");
    const plot = sampleExplicit(y, -1, 1, box);
    /* 1.5px / 64px·unit. 세로가 아니라 수직 오차 */
    expect(chordError(plot.parts, y, 0.15)).toBeLessThan(0.025);
    const outer = plot.parts.flat().filter((p) => Math.abs(p.x) > 0.15);
    expect(outer.length).toBeGreaterThan(40);
  });

  it("fills one envelope band across the origin", () => {
    const y = parseFn("sin(1/x)", "fn");
    const plot = sampleExplicit(y, -1, 1, box);
    expect(plot.bands).toHaveLength(1);
    const band = plot.bands[0]!;
    expect(band.x0).toBeLessThan(-0.03);
    expect(band.x1).toBeGreaterThan(0.03);
    expect(band.x1).toBeLessThan(0.2);
    expect(band.y1 - band.y0).toBeGreaterThan(1.6);
    expect(band.y0).toBeGreaterThanOrEqual(-1.05);
    expect(band.y1).toBeLessThanOrEqual(1.05);
    expect(band.columns.length).toBeGreaterThanOrEqual(4);
    for (const col of band.columns) {
      expect(col.hi).toBeGreaterThan(col.lo);
    }
    expect(crossesZero(plot.parts)).toBe(false);
  });

  it("tapers the band of x*sin(1/x) toward the origin", () => {
    /*
     * 큰 시트(2000px)여야 진폭 1.5px 이상이면서 주기 0.25px 아래인 구간이 생긴다.
     * 원점 바로 옆은 진폭이 스트로크보다 작아 곡선으로 남으므로 띠는 양쪽에 하나씩.
     */
    const y = parseFn("x*sin(1/x)", "fn");
    const wide = { xmin: -0.5, xmax: 0.5, ymin: -0.5, ymax: 0.5 };
    const plot = sampleExplicit(y, -0.5, 0.5, wide, 2000);
    expect(plot.bands).toHaveLength(2);
    for (const band of plot.bands) {
      const cols = band.columns;
      const near = cols.reduce((best, c) =>
        Math.abs(c.x0 + c.x1) < Math.abs(best.x0 + best.x1) ? c : best,
      );
      const far = cols.reduce((best, c) =>
        Math.abs(c.x0 + c.x1) > Math.abs(best.x0 + best.x1) ? c : best,
      );
      expect(near.hi - near.lo).toBeLessThan((far.hi - far.lo) / 2);
    }
  });

  it("keeps a period-3px sine as a polyline, not a band", () => {
    /* 280px 시트, 뷰 ±2 → 64px/unit. sin(140x) 주기 0.045 unit ≈ 2.9px. 8 배 줌에서 그릴 수 있다. */
    const y = parseFn("sin(140*x)", "fn");
    const plot = sampleExplicit(y, -2, 2, box);
    expect(plot.bands).toHaveLength(0);
    expect(plot.parts.flat().length).toBeGreaterThan(800);
  });

  it("does not turn the poles of tan(1/x) into bands", () => {
    const y = parseFn("tan(1/x)", "fn");
    const plot = sampleExplicit(y, -1, 1, { xmin: -1, xmax: 1, ymin: -3, ymax: 3 }, 560);
    /* 극이 픽셀 안에 몰리는 |x| < 0.03 만 띠. 고립 극(x = 0.049, 0.037…)은 아니다. */
    expect(plot.bands).toHaveLength(1);
    expect(Math.abs(plot.bands[0]!.x0)).toBeLessThan(0.035);
    expect(Math.abs(plot.bands[0]!.x1)).toBeLessThan(0.035);
  });

  it("stays within the evaluation budget for sin(1/x)", () => {
    let calls = 0;
    const inner = parseFn("sin(1/x)", "fn");
    const y = (x: number) => {
      calls += 1;
      return inner(x);
    };
    sampleExplicit(y, -1, 1, box);
    expect(calls).toBeLessThan(4000);
  });

  it("breaks 1/x at the pole without a band", () => {
    const y = parseFn("1/x", "fn");
    const plot = sampleExplicit(y, -2, 2, box);
    expect(plot.bands).toHaveLength(0);
    expect(plot.parts.length).toBeGreaterThan(1);
    expect(crossesZero(plot.parts, 0)).toBe(false);
  });

  it("keeps vertices stable across a small view zoom", () => {
    const y = parseFn("sin(x)", "fn");
    const wide = { xmin: -6.3, xmax: 6.3, ymin: -2, ymax: 2 };
    const zoomed = { xmin: -5.8, xmax: 5.8, ymin: -1.85, ymax: 1.85 };
    const a = sampleExplicit(y, -6.3, 6.3, wide);
    const b = sampleExplicit(y, -6.3, 6.3, zoomed);
    expect(a.bands).toHaveLength(0);
    /* 뷰 밖은 잘리므로 공통 구간만. 끝점은 뷰 경계라 다르다 */
    const shared = (p: { x: number }) => Math.abs(p.x) < 5.79;
    expect(b.parts[0]!.filter(shared).map((p) => [p.x, p.y])).toEqual(
      a.parts[0]!.filter(shared).map((p) => [p.x, p.y]),
    );
  });

  it("fills a horizontal envelope for x = sin(1/y)", () => {
    const x = (t: number) => Math.sin(1 / t);
    const plot = sampleExplicit(x, -1, 1, box, undefined, "y");
    expect(plot.bands).toHaveLength(1);
    const band = plot.bands[0]!;
    expect(band.along).toBe("y");
    /* 열은 독립축(y) 순. 세계에서는 원점 옆 가로 띠. */
    expect(band.x0).toBeLessThan(-0.03);
    expect(band.x1).toBeGreaterThan(0.03);
    expect(band.x1).toBeLessThan(0.2);
    expect(band.y1 - band.y0).toBeGreaterThan(1.6);
    const outline = bandOutline(band);
    expect(outline.some((p) => Math.abs(p.y) < 0.05 && Math.abs(p.x) > 0.8)).toBe(true);
    expect(plot.parts.some((part) => part.some((p) => Math.abs(p.y) > 0.15))).toBe(true);
  });

  it("does not connect tan(x) across an asymptote", () => {
    const y = parseFn("tan(x)", "fn");
    const plot = sampleExplicit(y, 0, 3, {
      xmin: 0,
      xmax: 3,
      ymin: -5,
      ymax: 5,
    });
    expect(plot.bands).toHaveLength(0);
    for (const part of plot.parts) {
      for (let i = 1; i < part.length; i += 1) {
        const rise = Math.abs(part[i]!.y - part[i - 1]!.y);
        expect(rise).toBeLessThan(9);
      }
    }
  });
});
