import { describe, expect, it } from "vitest";
import { applyFigure, hitFigure, placeFigure } from "@stemfig/host";
import { initGeometry } from "../init.ts";
import { baseDoc, pageAt, pageOf, registry, specOf } from "./test-harness.ts";

/** 원 A–B (r=4) 위, 꼭짓점 히트 반경 밖. */
const ON_RING_X = Math.sqrt(7);
const ON_RING_Y = 3;

describe("circle ring hit/apply", () => {
  it("hits the circumference away from vertices", () => {
    const doc = docWithCircle();
    const [x, y] = pageAt(doc, ON_RING_X, ON_RING_Y);
    const circ = specOf(doc).objects.find((obj) => obj.def[0] === "circle");
    expect(hitFigure(doc, "tri", x, y, registry())).toBe(circ?.id);
  });

  it("prefers a vertex over the ring", () => {
    const doc = docWithCircle();
    const [ax, ay] = pageOf(doc, "A");
    expect(hitFigure(doc, "tri", ax, ay, registry())).toBe("A");
  });

  it("translates the circle when both ends are free", () => {
    const doc = docWithCircle();
    const circ = specOf(doc).objects.find((obj) => obj.def[0] === "circle");
    const before = initGeometry(specOf(doc));
    const a0 = before.points.get("A")!;
    const next = applyFigure(
      doc,
      "tri",
      { id: circ!.id, dx_mm: 5, dy_mm: 0 },
      registry(),
    );
    const after = initGeometry(specOf(next));
    expect(after.points.get("A")!.x).toBeGreaterThan(a0.x);
    expect(after.points.get("B")!.x).toBeGreaterThan(0);
    const ca = after.points.get("A")!;
    const cb = after.points.get("B")!;
    expect(cb.x - ca.x).toBeCloseTo(4);
    expect(cb.y - ca.y).toBeCloseTo(0);
  });

  it("does not move a circle whose through point is on_path", () => {
    const [ax, ay] = pageOf(baseDoc, "A");
    const [px, py] = pageAt(baseDoc, 1, 0);
    const onPath = placeFigure(baseDoc, "tri", "point", px, py, registry());
    const d = specOf(onPath.doc).objects.find((obj) => obj.def[0] === "on_path");
    expect(d?.id).toBe("D");
    const first = placeFigure(onPath.doc, "tri", "circle", ax, ay, registry());
    const [dx, dy] = pageOf(first.doc, "D");
    const withCirc = placeFigure(first.doc, "tri", "circle", dx, dy, registry());
    const circ = specOf(withCirc.doc).objects.find((obj) => obj.def[0] === "circle");
    const before = specOf(withCirc.doc).objects;
    const next = applyFigure(
      withCirc.doc,
      "tri",
      { id: circ!.id, dx_mm: 8, dy_mm: 0 },
      registry(),
    );
    expect(specOf(next).objects).toEqual(before);
  });
});

function docWithCircle() {
  const [ax, ay] = pageOf(baseDoc, "A");
  const [bx, by] = pageOf(baseDoc, "B");
  const first = placeFigure(baseDoc, "tri", "circle", ax, ay, registry());
  return placeFigure(first.doc, "tri", "circle", bx, by, registry()).doc;
}
