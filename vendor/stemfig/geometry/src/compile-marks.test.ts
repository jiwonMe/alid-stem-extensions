/**
 * 직각 □, 등각 겹호, 변 틱. fixture 좌표만.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE, measureLabelMm } from "@stemfig/display";
import { compileDocument, parseDocument, Registry } from "@stemfig/host";
import right from "../fixtures/right-triangle.stemfig.json";
import { mathGeometryPlugin } from "./index.ts";
import { compileGeometry } from "./compile.ts";
import { initGeometry } from "./init.ts";
import { ANGLE_MARK_WIDTH_MM, DOT_R_MM } from "./mark-geom.ts";
import { geometrySpecSchema } from "./schema.ts";
import { SEG_ARC_WIDTH_MM } from "./seg-label-arc.ts";

const doc = parseDocument(right);

function registry(): Registry {
  const next = new Registry();
  next.register(mathGeometryPlugin);
  return next;
}

describe("compileMarks", () => {
  it("draws a right-angle square on the right-triangle fixture", () => {
    const list = compileDocument(doc, registry());
    const group = list.items[0];
    expect(group?.op).toBe("group");
    if (group && group.op === "group") {
      const squares = group.items.filter(
        (item) => item.op === "polyline" && item.points.length === 3,
      );
      expect(squares.length).toBeGreaterThanOrEqual(1);
      const labels = group.items.filter((item) => item.op === "text");
      expect(labels.some((item) => item.op === "text" && item.text === "4")).toBe(
        true,
      );
    }
  });

  it("draws two equal-arc polylines when ticks is 2", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 2, 0] },
        { id: "C", def: ["point", 0, 2] },
      ],
      angles: [{ id: "n", a: "B", v: "A", b: "C", mark: "equal", ticks: 2 }],
    });
    const items = compileGeometry(
      {
        frame: { x: 0, y: 0, w: 80, h: 60 },
        view: { xmin: -1, xmax: 5, ymin: -1, ymax: 5 },
        mmToPage: (x, y) => [x, y],
        style: DEFAULT_STYLE,
      },
      initGeometry(spec),
    );
    const arcs = items.filter(
      (item) => item.op === "polyline" && item.points.length === 17,
    );
    expect(arcs).toHaveLength(2);
    expect(
      arcs.every(
        (item) => item.op === "polyline" && item.width === ANGLE_MARK_WIDTH_MM,
      ),
    ).toBe(true);
  });

  it("draws empty circles along the angle when style is circle", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 2, 0] },
        { id: "C", def: ["point", 0, 2] },
      ],
      angles: [
        { id: "n", a: "B", v: "A", b: "C", mark: "equal", style: "circle", ticks: 3 },
      ],
    });
    const items = compileGeometry(
      {
        frame: { x: 0, y: 0, w: 80, h: 60 },
        view: { xmin: -1, xmax: 5, ymin: -1, ymax: 5 },
        mmToPage: (x, y) => [x, y],
        style: DEFAULT_STYLE,
      },
      initGeometry(spec),
    );
    const rings = items.filter((item) => item.op === "circle" && !item.fill);
    expect(rings).toHaveLength(1);
    const arcs = items.filter(
      (item) => item.op === "polyline" && item.points.length === 17,
    );
    expect(arcs).toHaveLength(1);
  });

  it("draws at most two small dots when style is dot", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 2, 0] },
        { id: "C", def: ["point", 0, 2] },
      ],
      angles: [
        { id: "n", a: "B", v: "A", b: "C", mark: "equal", style: "dot", ticks: 3 },
      ],
    });
    const items = compileGeometry(
      {
        frame: { x: 0, y: 0, w: 80, h: 60 },
        view: { xmin: -1, xmax: 5, ymin: -1, ymax: 5 },
        mmToPage: (x, y) => [x, y],
        style: DEFAULT_STYLE,
      },
      initGeometry(spec),
    );
    const dots = items.filter(
      (item) => item.op === "circle" && item.r === DOT_R_MM,
    );
    expect(dots).toHaveLength(2);
    expect(dots.every((item) => item.op === "circle" && item.fill)).toBe(true);
  });

  it("draws one tick between two points without a segment object", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 4, 0] },
      ],
      marks: [{ id: "k", a: "A", b: "B", ticks: 1 }],
    });
    const items = compileGeometry(
      {
        frame: { x: 0, y: 0, w: 80, h: 60 },
        view: { xmin: -1, xmax: 5, ymin: -1, ymax: 5 },
        mmToPage: (x, y) => [x, y],
        style: DEFAULT_STYLE,
      },
      initGeometry(spec),
    );
    const ticks = items.filter(
      (item) => item.op === "polyline" && item.points.length === 2,
    );
    expect(ticks.length).toBeGreaterThanOrEqual(1);
  });

  it("draws empty circles on the segment when style is circle", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 4, 0] },
      ],
      marks: [{ id: "k", a: "A", b: "B", ticks: 3, style: "circle" }],
    });
    const items = compileGeometry(
      {
        frame: { x: 0, y: 0, w: 80, h: 60 },
        view: { xmin: -1, xmax: 5, ymin: -1, ymax: 5 },
        mmToPage: (x, y) => [x, y],
        style: DEFAULT_STYLE,
      },
      initGeometry(spec),
    );
    const rings = items.filter((item) => item.op === "circle" && !item.fill);
    expect(rings).toHaveLength(1);
    const ticks = items.filter(
      (item) => item.op === "polyline" && item.points.length === 2,
    );
    expect(ticks).toHaveLength(0);
  });

  it("draws a dashed bow and a mid label when style is arc", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 4, 0] },
      ],
      marks: [{ id: "k", a: "A", b: "B", ticks: 1, style: "arc", label: "4" }],
    });
    const items = compileGeometry(
      {
        frame: { x: 0, y: 0, w: 80, h: 60 },
        view: { xmin: -1, xmax: 5, ymin: -1, ymax: 5 },
        mmToPage: (x, y) => [x, y],
        style: DEFAULT_STYLE,
      },
      initGeometry(spec),
    );
    const dashes = items.filter((item) => item.op === "polyline");
    expect(dashes.length).toBeGreaterThan(2);
    expect(
      dashes.every(
        (item) => item.op === "polyline" && item.width === SEG_ARC_WIDTH_MM,
      ),
    ).toBe(true);
    expect(SEG_ARC_WIDTH_MM).toBeLessThan(DEFAULT_STYLE.width);
    const labels = items.filter(
      (item) => item.op === "text" && item.text === "4",
    );
    expect(labels).toHaveLength(1);
    const text = labels[0]!;
    if (text.op !== "text") {
      return;
    }
    const box = measureLabelMm("4", DEFAULT_STYLE.textSize);
    const x0 = text.x + box.x;
    const y0 = text.y + box.y;
    for (const dash of dashes) {
      if (dash.op !== "polyline") {
        continue;
      }
      for (const [x, y] of dash.points) {
        expect(
          x > x0 && x < x0 + box.w && y > y0 && y < y0 + box.h,
        ).toBe(false);
      }
    }
  });
});
