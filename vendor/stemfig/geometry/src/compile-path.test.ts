/**
 * 무한직선 clip. contain 여백까지 figure 를 채운다.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE } from "@stemfig/display";
import { projectView } from "@stemfig/plugin-kit";
import { compilePathGeom, clipLineToFrame } from "./compile-path.ts";

const FRAME = { x: 5, y: 5, w: 70, h: 50 };

describe("clipLineToFrame", () => {
  it("extends a horizontal page line to both frame edges", () => {
    const clipped = clipLineToFrame({ x: 20, y: 30 }, { x: 40, y: 30 }, FRAME);
    expect(clipped?.[0]).toEqual({ x: 5, y: 30 });
    expect(clipped?.[1]).toEqual({ x: 75, y: 30 });
  });
});

describe("compilePathGeom circle", () => {
  it("emits a circle when axes share a scale", () => {
    const view = { xmin: 0, xmax: 8, ymin: 0, ymax: 6 };
    const frame = { x: 0, y: 0, w: 80, h: 60 };
    const { toPage } = projectView(
      { frame, mmToPage: (x, y) => [x, y] },
      view,
    );
    const items = compilePathGeom(
      { kind: "circle", c: { x: 4, y: 3 }, through: { x: 6, y: 3 } },
      frame,
      toPage,
      DEFAULT_STYLE,
    );
    expect(items[0]).toMatchObject({ op: "circle", cx: 40, cy: 30, r: 20 });
  });

  it("emits an ellipse when stretch scales differ", () => {
    const view = { xmin: 0, xmax: 8, ymin: 0, ymax: 6, stretch: true };
    const frame = { x: 0, y: 0, w: 80, h: 40 };
    const { toPage } = projectView(
      { frame, mmToPage: (x, y) => [x, y] },
      view,
    );
    const items = compilePathGeom(
      { kind: "circle", c: { x: 4, y: 3 }, through: { x: 6, y: 3 } },
      frame,
      toPage,
      DEFAULT_STYLE,
    );
    expect(items[0]).toMatchObject({ op: "ellipse", cx: 40, cy: 20, rx: 20 });
    expect(items[0] && items[0].op === "ellipse" ? items[0].ry : 0).toBeCloseTo(
      40 / 3,
    );
  });
});

describe("compilePathGeom line", () => {
  it("reaches the figure box when view and frame aspect differ", () => {
    /* view 5×4, frame 70×50. contain 이면 좌우 3.75mm 여백. */
    const view = { xmin: -0.5, xmax: 4.5, ymin: -0.5, ymax: 3.5 };
    const { toPage } = projectView(
      {
        frame: FRAME,
        mmToPage: (x, y) => [FRAME.x + x, FRAME.y + y],
      },
      view,
    );
    const items = compilePathGeom(
      {
        kind: "line",
        a: { x: 0, y: 0 },
        b: { x: 4, y: 0 },
        bound: false,
      },
      FRAME,
      toPage,
      DEFAULT_STYLE,
    );
    const line = items[0];
    expect(line?.op).toBe("polyline");
    if (line?.op !== "polyline") {
      return;
    }
    const xs = line.points.map((pt) => pt[0]).sort((left, right) => left - right);
    expect(xs[0]).toBeCloseTo(FRAME.x);
    expect(xs[1]).toBeCloseTo(FRAME.x + FRAME.w);
  });
});
