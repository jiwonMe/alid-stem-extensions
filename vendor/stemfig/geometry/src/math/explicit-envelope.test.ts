/**
 * 열 봉투 단위 테스트. 어느 구간이 띠인지는 묻지 않고 주어진 구간의 모양만 본다.
 */
import { describe, expect, it } from "vitest";
import { bandContains, bandOutline, envelopeOf } from "./explicit-envelope.ts";
import { screenMap } from "./explicit-screen.ts";

const box = { xmin: -1, xmax: 1, ymin: -2, ymax: 2 };
const screen = screenMap(box, 560)!;

describe("envelopeOf", () => {
  it("gives a flat ±1 envelope for a constant-amplitude oscillation", () => {
    const band = envelopeOf((x) => Math.sin(4000 * x), { x0: -0.5, x1: 0.5 }, screen)!;
    expect(band).toBeDefined();
    /* 황금분할로 봉우리를 조이므로 열마다 최대가 1 에서 1% 안에 있어야 확대해도 계단이 없다. */
    for (const col of band.columns) {
      expect(col.hi).toBeGreaterThan(0.99);
      expect(col.lo).toBeLessThan(-0.99);
    }
    expect(band.y1).toBeLessThanOrEqual(1 + 1e-9);
    expect(band.y0).toBeGreaterThanOrEqual(-1 - 1e-9);
  });

  it("tapers x·sin(1/x) toward the origin", () => {
    const band = envelopeOf((x) => x * Math.sin(1 / x), { x0: 0.002, x1: 0.1 }, screen)!;
    const cols = band.columns;
    const first = cols[0]!;
    const last = cols[cols.length - 1]!;
    expect(first.hi - first.lo).toBeLessThan(last.hi - last.lo);
  });

  it("clips the envelope to the view box", () => {
    const band = envelopeOf((x) => 10 * Math.sin(4000 * x), { x0: -0.5, x1: 0.5 }, screen)!;
    expect(band.y1).toBeLessThanOrEqual(box.ymax);
    expect(band.y0).toBeGreaterThanOrEqual(box.ymin);
  });

  it("returns undefined when nothing finite lies in the span", () => {
    expect(envelopeOf(() => Number.NaN, { x0: 0, x1: 0.1 }, screen)).toBeUndefined();
  });
});

describe("bandOutline / bandContains", () => {
  const band = envelopeOf((x) => x * Math.sin(1 / x), { x0: 0.002, x1: 0.1 }, screen)!;

  it("closes the outline and walks the top left→right", () => {
    const outline = bandOutline(band);
    expect(outline[0]).toEqual(outline[outline.length - 1]);
    expect(outline[0]!.x).toBe(band.x0);
    expect(outline[0]!.y).toBe(band.columns[0]!.hi);
  });

  it("treats along=y columns as horizontal strips", () => {
    const vertical = envelopeOf((x) => Math.sin(4000 * x), { x0: -0.5, x1: 0.5 }, screen)!;
    const band = { ...vertical, along: "y" as const };
    expect(bandContains(band, 0, 0.1)).toBe(true);
    expect(bandContains(band, 2, 0.1)).toBe(false);
    const outline = bandOutline(band);
    expect(outline[0]!.y).toBe(vertical.columns[0]!.x0);
    expect(outline[0]!.x).toBe(vertical.columns[0]!.hi);
  });

  it("hits inside a column but not in the empty corner of the wedge", () => {
    const wide = band.columns[band.columns.length - 1]!;
    const narrow = band.columns[0]!;
    const mid = (c: { x0: number; x1: number }) => (c.x0 + c.x1) / 2;
    expect(bandContains(band, mid(wide), 0)).toBe(true);
    /* AABB 안이지만 좁은 열의 봉투 밖. 열 단위 히트가 아니면 여기서 맞아 버린다. */
    expect(bandContains(band, mid(narrow), wide.hi * 0.9)).toBe(false);
  });
});
