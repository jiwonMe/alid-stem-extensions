/** 스냅·경로 위 점 상호작용을 실제 호스트 경계로 검증한다. */
import { describe, expect, it } from "vitest";
import { fitView } from "@stemfig/display";
import { applyFigure, figuresOf, hitFigure, listAnchors, placeFigure, snapFigure } from "@stemfig/host";
import { initGeometry } from "../init.ts";
import { doc, registry, specOf, pageOf, pageAt } from "./interact-fixture.ts";

describe("math.geometry interaction: 스냅·경로 위 점", () => {
  it("snaps the cursor to a free point and skips the dragged one", () => {
    const [ax, ay] = pageOf("A");
    const [bx, by] = pageOf("B");
    const hit = snapFigure(doc, "tri", ax, ay, registry());
    expect(hit).toEqual({
      kind: "point",
      id: "A",
      x_mm: expect.closeTo(ax),
      y_mm: expect.closeTo(ay),
    });
    expect(snapFigure(doc, "tri", ax, ay, registry(), "A")).toBeNull();
    const nearB = snapFigure(doc, "tri", bx, by, registry(), "A");
    expect(nearB).toMatchObject({ id: "B" });
    const [x, y] = pageAt(3, 2);
    expect(snapFigure(doc, "tri", x, y, registry())).toBeNull();
  });

  it("snaps onto a segment away from vertices", () => {
    const [x, y] = pageAt(1, 0);
    const hit = snapFigure(doc, "tri", x, y, registry());
    expect(hit?.kind).toBe("path");
    expect(hit).toMatchObject({ id: "c" });
    expect(hit?.x_mm).toBeCloseTo(x);
    expect(hit?.y_mm).toBeCloseTo(y);
  });

  it("snaps to division M like a vertex", () => {
    const [x, y] = pageOf("M");
    const hit = snapFigure(doc, "tri", x, y, registry());
    expect(hit).toEqual({
      kind: "point",
      id: "M",
      x_mm: expect.closeTo(x),
      y_mm: expect.closeTo(y),
    });
  });

  it("prefers division M over segment c when the cursor is on the segment nearby", () => {
    const [x, y] = pageAt(2.2, 0);
    const hit = snapFigure(doc, "tri", x, y, registry());
    expect(hit?.kind).toBe("point");
    expect(hit).toMatchObject({ id: "M" });
  });

  it("shrinks the snap radius in mm when the canvas is zoomed in", () => {
    const [x, y] = pageAt(1, 0.1);
    expect(snapFigure(doc, "tri", x, y, registry())).toMatchObject({ id: "c" });
    expect(
      snapFigure(doc, "tri", x, y, registry(), undefined, false, 4 * 8),
    ).toBeNull();
  });

  it("reuses division M when placing a segment on it", () => {
    const [x, y] = pageOf("M");
    const { doc: next, handleId } = placeFigure(
      doc,
      "tri",
      "segment",
      x,
      y,
      registry(),
    );
    expect(handleId).toBe("M");
    expect(specOf(next).draft).toEqual({ tool: "segment", from: "M" });
    expect(specOf(next).objects).toHaveLength(specOf(doc).objects.length);
  });

  it("selects a segment that ends on division M and does not translate it", () => {
    /* A–M 은 변 c 와 겹친다. 중선 C–M 으로 고른다. */
    const [cx, cy] = pageOf("C");
    const [mx, my] = pageOf("M");
    const first = placeFigure(doc, "tri", "segment", cx, cy, registry());
    const { doc: next, handleId } = placeFigure(
      first.doc,
      "tri",
      "segment",
      mx,
      my,
      registry(),
    );
    expect(handleId).toBeTruthy();
    expect(specOf(next).objects.find((obj) => obj.id === handleId)?.def).toEqual([
      "segment",
      "C",
      "M",
    ]);
    const [hx, hy] = [(cx + mx) / 2, (cy + my) / 2];
    expect(hitFigure(next, "tri", hx, hy, registry())).toBe(handleId);
    expect(
      listAnchors(next, "tri", registry()).some((item) => item.id === handleId),
    ).toBe(true);
    const before = specOf(next).objects;
    const dragged = applyFigure(
      next,
      "tri",
      { id: handleId!, dx_mm: 10, dy_mm: 10 },
      registry(),
    );
    expect(specOf(dragged).objects).toEqual(before);
  });

  it("places a new point on a segment at the foot", () => {
    const [x, y] = pageAt(1, 0);
    const { doc: next, handleId } = placeFigure(
      doc,
      "tri",
      "point",
      x,
      y,
      registry(),
    );
    expect(handleId).toBe("D");
    const placed = specOf(next).objects.find((obj) => obj.id === "D")?.def;
    expect(placed?.[0]).toBe("on_path");
    expect(placed?.[1]).toBe("c");
    expect(placed?.[2]).toBeCloseTo(0.25);
    expect(initGeometry(specOf(next)).points.get("D")).toEqual({
      x: 1,
      y: 0,
    });
    expect(hitFigure(next, "tri", x, y, registry())).toBe("D");
    expect(
      listAnchors(next, "tri", registry()).some((item) => item.id === "D"),
    ).toBe(true);
  });

  it("starts a segment from an on_path point", () => {
    const [x, y] = pageAt(1, 0);
    const { doc: next, handleId } = placeFigure(
      doc,
      "tri",
      "segment",
      x,
      y,
      registry(),
    );
    expect(handleId).toBe("D");
    expect(specOf(next).objects.find((obj) => obj.id === "D")?.def[0]).toBe(
      "on_path",
    );
    expect(specOf(next).draft).toEqual({ tool: "segment", from: "D" });
  });

  it("selects a segment whose ends are on_path and does not translate it", () => {
    const [x1, y1] = pageAt(1, 0);
    const [x2, y2] = pageAt(2.6, 1.5);
    const first = placeFigure(doc, "tri", "segment", x1, y1, registry());
    const { doc: next, handleId } = placeFigure(
      first.doc,
      "tri",
      "segment",
      x2,
      y2,
      registry(),
    );
    expect(handleId).toBe("d");
    expect(specOf(next).objects.find((obj) => obj.id === "d")?.def).toEqual([
      "segment",
      "D",
      "E",
    ]);
    const [mx, my] = pageAt(1.8, 0.75);
    expect(hitFigure(next, "tri", mx, my, registry())).toBe("d");
    expect(
      listAnchors(next, "tri", registry()).some((item) => item.id === "d"),
    ).toBe(true);
    const before = specOf(next).objects;
    const dragged = applyFigure(
      next,
      "tri",
      { id: "d", dx_mm: 10, dy_mm: 10 },
      registry(),
    );
    expect(specOf(dragged).objects).toEqual(before);
  });

  it("slides an on_path point along the segment and not off it", () => {
    const [x, y] = pageAt(1, 0);
    const first = placeFigure(doc, "tri", "point", x, y, registry());
    const off = applyFigure(
      first.doc,
      "tri",
      { id: "D", dx_mm: 0, dy_mm: 20 },
      registry(),
    );
    const still = initGeometry(specOf(off)).points.get("D");
    expect(still?.y).toBeCloseTo(0);
    expect(still?.x).toBeCloseTo(1);
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
    expect(moved?.y).toBeCloseTo(0);
    expect(moved?.x).toBeCloseTo(2);
    const clamped = applyFigure(
      first.doc,
      "tri",
      { id: "D", dx_mm: -100, dy_mm: 0 },
      registry(),
    );
    expect(initGeometry(specOf(clamped)).points.get("D")).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("keeps t when the path endpoints move", () => {
    const [x, y] = pageAt(1, 0);
    const first = placeFigure(doc, "tri", "point", x, y, registry());
    const { scale } = fitView(figuresOf(first.doc)[0]!.view, {
      x: 5,
      y: 5,
      w: 70,
      h: 50,
    });
    const next = applyFigure(
      first.doc,
      "tri",
      { id: "A", dx_mm: scale, dy_mm: 0 },
      registry(),
    );
    const def = specOf(next).objects.find((obj) => obj.id === "D")?.def;
    expect(def?.[0]).toBe("on_path");
    expect(def?.[1]).toBe("c");
    expect(def?.[2]).toBeCloseTo(0.25);
    expect(initGeometry(specOf(next)).points.get("D")).toEqual({
      x: 1.75,
      y: 0,
    });
  });


});
