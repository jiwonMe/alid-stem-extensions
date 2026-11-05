import { describe, expect, it } from "vitest";
import { fitView } from "./fit-view.ts";
import { nudgeViewPan, nudgeViewZoomAt, resizeView } from "./nudge-view.ts";

const frame = { x: 0, y: 0, w: 80, h: 60 };
const view = { xmin: 0, xmax: 8, ymin: 0, ymax: 6 };

describe("nudgeViewPan", () => {
  it("keeps the grabbed math point under the moved local cursor", () => {
    const fit = fitView(view, frame);
    const [lx, ly] = fit.toLocal(4, 3);
    const next = nudgeViewPan(view, frame, 10, 5);
    const [x, y] = fitView(next, frame).fromLocal(lx + 10, ly + 5);
    expect(x).toBeCloseTo(4);
    expect(y).toBeCloseTo(3);
  });
});

describe("nudgeViewZoomAt", () => {
  it("keeps the math point under the cursor after zoom", () => {
    const fit = fitView(view, frame);
    const [lx, ly] = fit.toLocal(2, 1);
    const next = nudgeViewZoomAt(view, frame, lx, ly, 2);
    const [x, y] = fitView(next, frame).fromLocal(lx, ly);
    expect(x).toBeCloseTo(2);
    expect(y).toBeCloseTo(1);
    expect(next.xmax - next.xmin).toBeCloseTo(4);
    expect(next.ymax - next.ymin).toBeCloseTo(3);
  });

  it("rejects a non-positive factor", () => {
    expect(nudgeViewZoomAt(view, frame, 10, 10, 0)).toEqual(view);
    expect(nudgeViewZoomAt(view, frame, 10, 10, -2)).toEqual(view);
  });

  it("zooms only one axis when asked", () => {
    const nextX = nudgeViewZoomAt(view, frame, 40, 30, 2, "x");
    expect(nextX.xmax - nextX.xmin).toBeCloseTo(4);
    expect(nextX.ymax - nextX.ymin).toBeCloseTo(6);
    const nextY = nudgeViewZoomAt(view, frame, 40, 30, 2, "y");
    expect(nextY.xmax - nextY.xmin).toBeCloseTo(8);
    expect(nextY.ymax - nextY.ymin).toBeCloseTo(3);
  });

  it("keeps stretch when panning a stretched window", () => {
    const stretched = { ...view, stretch: true as const };
    const next = nudgeViewPan(stretched, frame, 10, 0);
    expect(next.stretch).toBe(true);
    expect(next.xmax - next.xmin).toBe(8);
  });
});

describe("resizeView", () => {
  it("keeps scale and grows xmax when the east edge moves", () => {
    const to = { ...frame, w: 96 };
    const next = resizeView(view, frame, to);
    expect(fitView(next, to).scaleX).toBeCloseTo(fitView(view, frame).scaleX);
    expect(next.xmin).toBeCloseTo(0);
    expect(next.xmax).toBeCloseTo(9.6);
    expect(next.ymin).toBeCloseTo(0);
    expect(next.ymax).toBeCloseTo(6);
  });

  it("grows xmin when the west edge moves out", () => {
    const to = { x: -16, y: 0, w: 96, h: 60 };
    const next = resizeView(view, frame, to);
    expect(fitView(next, to).scaleX).toBeCloseTo(10);
    expect(next.xmin).toBeCloseTo(-1.6);
    expect(next.xmax).toBeCloseTo(8);
  });

  it("grows ymax when the north edge moves up", () => {
    const to = { x: 0, y: -12, w: 80, h: 72 };
    const next = resizeView(view, frame, to);
    expect(fitView(next, to).scaleY).toBeCloseTo(10);
    expect(next.ymax).toBeCloseTo(7.2);
    expect(next.ymin).toBeCloseTo(0);
  });

  it("grows ymin when the south edge moves down", () => {
    const to = { ...frame, h: 72 };
    const next = resizeView(view, frame, to);
    expect(fitView(next, to).scaleY).toBeCloseTo(10);
    expect(next.ymin).toBeCloseTo(-1.2);
    expect(next.ymax).toBeCloseTo(6);
  });
});
