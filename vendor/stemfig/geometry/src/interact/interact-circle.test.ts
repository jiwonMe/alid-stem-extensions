/** 원 위 점·원 작도 상호작용을 실제 호스트 경계로 검증한다. */
import { describe, expect, it } from "vitest";
import { fitView } from "@stemfig/display";
import { applyFigure, figuresOf, hitFigure, placeFigure, previewFigure, snapFigure } from "@stemfig/host";
import { initGeometry } from "../init.ts";
import { doc, registry, specOf, pageOf, pageAt, docWithCircle, ON_CIRCLE_X, ON_CIRCLE_Y } from "./interact-fixture.ts";

describe("math.geometry interaction: 원 위 점·원 작도", () => {
  it("snaps onto a circle away from vertices", () => {
    const withRing = docWithCircle();
    const [x, y] = pageAt(ON_CIRCLE_X, ON_CIRCLE_Y);
    const hit = snapFigure(withRing, "tri", x, y, registry());
    expect(hit?.kind).toBe("path");
    expect(hit).toMatchObject({ id: "d" });
    expect(hit?.x_mm).toBeCloseTo(x);
    expect(hit?.y_mm).toBeCloseTo(y);
  });

  it("places a new point on a circle at the foot", () => {
    const withRing = docWithCircle();
    const [x, y] = pageAt(ON_CIRCLE_X, ON_CIRCLE_Y);
    const { doc: next, handleId } = placeFigure(
      withRing,
      "tri",
      "point",
      x,
      y,
      registry(),
    );
    expect(handleId).toBe("D");
    const placed = specOf(next).objects.find((obj) => obj.id === "D")?.def;
    expect(placed?.[0]).toBe("on_path");
    expect(placed?.[1]).toBe("d");
    expect(placed?.[2]).toBeCloseTo(Math.atan2(ON_CIRCLE_Y, ON_CIRCLE_X));
    const at = initGeometry(specOf(next)).points.get("D");
    expect(at?.x).toBeCloseTo(ON_CIRCLE_X);
    expect(at?.y).toBeCloseTo(ON_CIRCLE_Y);
    expect(hitFigure(next, "tri", x, y, registry())).toBe("D");
  });

  it("slides an on_path point along the circle and not off it", () => {
    const withRing = docWithCircle();
    const [x, y] = pageAt(ON_CIRCLE_X, ON_CIRCLE_Y);
    const first = placeFigure(withRing, "tri", "point", x, y, registry());
    const { scale } = fitView(figuresOf(first.doc)[0]!.view, {
      x: 5,
      y: 5,
      w: 70,
      h: 50,
    });
    const along = applyFigure(
      first.doc,
      "tri",
      { id: "D", dx_mm: scale, dy_mm: 0 },
      registry(),
    );
    const moved = initGeometry(specOf(along)).points.get("D");
    expect(Math.hypot(moved?.x ?? 0, moved?.y ?? 0)).toBeCloseTo(4);
    expect(moved?.x).not.toBeCloseTo(ON_CIRCLE_X);
    const def = specOf(along).objects.find((obj) => obj.id === "D")?.def;
    expect(def?.[0]).toBe("on_path");
    expect(def?.[1]).toBe("d");
  });

  it("places a circle from center A through B", () => {
    const [ax, ay] = pageOf("A");
    const [bx, by] = pageOf("B");
    const first = placeFigure(doc, "tri", "circle", ax, ay, registry());
    expect(first.handleId).toBe("A");
    expect(specOf(first.doc).draft).toEqual({ tool: "circle", from: "A" });
    const { doc: next, handleId } = placeFigure(
      first.doc,
      "tri",
      "circle",
      bx,
      by,
      registry(),
    );
    expect(handleId).toBe("d");
    expect(specOf(next).objects.find((obj) => obj.id === "d")?.def).toEqual([
      "circle",
      "A",
      "B",
    ]);
    expect(specOf(next).draft).toBeUndefined();
    expect(figuresOf(next)[0]?.interaction?.handles).toContain("d");
  });

  it("creates two points and a circle on empty clicks", () => {
    const [x1, y1] = pageAt(3, 2);
    const [x2, y2] = pageAt(3.5, 2.5);
    const first = placeFigure(doc, "tri", "circle", x1, y1, registry());
    expect(first.handleId).toBe("D");
    const { doc: next, handleId } = placeFigure(
      first.doc,
      "tri",
      "circle",
      x2,
      y2,
      registry(),
    );
    expect(handleId).toBe("d");
    expect(specOf(next).objects.find((obj) => obj.id === "d")?.def).toEqual([
      "circle",
      "D",
      "E",
    ]);
    expect(initGeometry(specOf(next)).points.get("D")).toEqual({
      x: 3,
      y: 2,
    });
  });

  it("does not close a circle on the same point twice", () => {
    const [x, y] = pageOf("A");
    const first = placeFigure(doc, "tri", "circle", x, y, registry());
    const { doc: next, handleId } = placeFigure(
      first.doc,
      "tri",
      "circle",
      x,
      y,
      registry(),
    );
    expect(handleId).toBe("A");
    expect(specOf(next).draft).toEqual({ tool: "circle", from: "A" });
  });

  it("reuses an existing circle with the same center and through", () => {
    const [ax, ay] = pageOf("A");
    const [bx, by] = pageOf("B");
    const first = placeFigure(doc, "tri", "circle", ax, ay, registry());
    const made = placeFigure(first.doc, "tri", "circle", bx, by, registry());
    const again = placeFigure(made.doc, "tri", "circle", ax, ay, registry());
    const { doc: next, handleId } = placeFigure(
      again.doc,
      "tri",
      "circle",
      bx,
      by,
      registry(),
    );
    expect(handleId).toBe("d");
    expect(
      specOf(next).objects.filter((obj) => obj.def[0] === "circle"),
    ).toHaveLength(1);
  });

  it("previews a ghost circle from the draft center to the cursor", () => {
    const [ax, ay] = pageOf("A");
    const first = placeFigure(doc, "tri", "circle", ax, ay, registry());
    const [x, y] = pageAt(3, 2);
    const items = previewFigure(first.doc, "tri", "circle", x, y, registry());
    const ring = items.find(
      (item) => item.op === "circle" && item.r > 1,
    );
    expect(ring?.op).toBe("circle");
    if (ring?.op === "circle") {
      expect(ring.cx).toBeCloseTo(ax);
      expect(ring.cy).toBeCloseTo(ay);
      expect(ring.r).toBeCloseTo(Math.hypot(x - ax, y - ay));
    }
  });

  it("previews a ghost on the path, not a vertex reuse", () => {
    const [x, y] = pageAt(1, 0);
    const items = previewFigure(doc, "tri", "point", x, y, registry());
    const mark = items.find((item) => item.op === "circle");
    expect(mark?.op).toBe("circle");
    if (mark?.op === "circle") {
      expect(mark.cx).toBeCloseTo(x);
      expect(mark.cy).toBeCloseTo(y);
    }
  });
});
