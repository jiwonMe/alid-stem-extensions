/** 기본 선택·배치·미리보기 상호작용을 실제 호스트 경계로 검증한다. */
import { describe, expect, it } from "vitest";
import { fitView } from "@stemfig/display";
import { applyFigure, figuresOf, hitFigure, listAnchors, placeFigure, previewFigure, snapFigure } from "@stemfig/host";
import { initGeometry } from "../init.ts";
import { doc, registry, specOf, pageOf, pageAt } from "./interact-fixture.ts";

describe("math.geometry interaction: 기본 선택·배치·미리보기", () => {
  it("hits free point A and misses the frame corner", () => {
    const [x, y] = pageOf("A");
    expect(hitFigure(doc, "tri", x, y, registry())).toBe("A");
    expect(hitFigure(doc, "tri", 5, 5, registry())).toBeNull();
  });

  it("hits division M for hover and does not move it", () => {
    const before = specOf(doc);
    const next = applyFigure(
      doc,
      "tri",
      { id: "M", dx_mm: 10, dy_mm: 0 },
      registry(),
    );
    expect(specOf(next).objects).toEqual(before.objects);
    const [x, y] = pageOf("M");
    expect(hitFigure(doc, "tri", x, y, registry())).toBe("M");
  });

  it("moves A in spec and recomputes division M", () => {
    const { scale } = fitView(figuresOf(doc)[0]!.view, { x: 5, y: 5, w: 70, h: 50 });
    const next = applyFigure(
      doc,
      "tri",
      { id: "A", dx_mm: scale, dy_mm: 0 },
      registry(),
    );
    const spec = specOf(next);
    expect(spec.objects.find((obj) => obj.id === "A")?.def).toEqual([
      "point",
      1,
      0,
    ]);
    expect(initGeometry(spec).points.get("M")).toEqual({ x: 2.5, y: 0 });
  });

  it("lists point, segment, and visible division anchors", () => {
    const anchors = listAnchors(doc, "tri", registry());
    const ids = anchors.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(["A", "B", "C", "a", "b", "c", "M"]));
    expect(anchors.find((item) => item.id === "A")?.kind).toBe("point");
    expect(anchors.find((item) => item.id === "M")?.kind).toBe("point");
    expect(anchors.find((item) => item.id === "c")?.kind).toBe("line");
  });

  it("places free point D at the click and unlocks it", () => {
    const figure = figuresOf(doc)[0]!;
    const { toLocal } = fitView(figure.view, figure.frame);
    const [lx, ly] = toLocal(2, 1.5);
    const x = figure.frame.x + lx;
    const y = figure.frame.y + ly;
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
    expect(placed?.[0]).toBe("point");
    expect(placed?.[1]).toBeCloseTo(2);
    expect(placed?.[2]).toBeCloseTo(1.5);
    expect(specOf(next).objects.find((obj) => obj.id === "D")?.label).toBe("D");
    expect(figuresOf(next)[0]?.interaction?.handles).toContain("D");
    expect(hitFigure(next, "tri", x, y, registry())).toBe("D");
  });

  it("reuses an existing point when the point tool snaps", () => {
    const [x, y] = pageOf("A");
    const { doc: next, handleId } = placeFigure(
      doc,
      "tri",
      "point",
      x,
      y,
      registry(),
    );
    expect(handleId).toBe("A");
    expect(specOf(next).objects).toHaveLength(specOf(doc).objects.length);
  });

  it("places a free point on a vertex and a segment when unsnap is set", () => {
    const [ax, ay] = pageOf("A");
    const onVertex = placeFigure(
      doc,
      "tri",
      "point",
      ax,
      ay,
      registry(),
      true,
    );
    expect(onVertex.handleId).toBe("D");
    expect(specOf(onVertex.doc).objects.find((obj) => obj.id === "D")?.def[0]).toBe(
      "point",
    );
    const [x, y] = pageAt(2, 0.1);
    const onPath = placeFigure(doc, "tri", "point", x, y, registry(), true);
    const def = specOf(onPath.doc).objects.find((obj) => obj.id === "D")?.def;
    expect(def?.[0]).toBe("point");
    expect(def?.[1]).toBeCloseTo(2);
    expect(def?.[2]).toBeCloseTo(0.1);
    expect(snapFigure(doc, "tri", x, y, registry(), undefined, true)).toBeNull();
    const ghost = previewFigure(doc, "tri", "point", x, y, registry(), true);
    const mark = ghost.find((item) => item.op === "circle");
    expect(mark?.op).toBe("circle");
    if (mark?.op === "circle") {
      expect(mark.cx).toBeCloseTo(x);
      expect(mark.cy).toBeCloseTo(y);
    }
  });

  it("leaves the document alone when the tool is unknown", () => {
    const { doc: next, handleId } = placeFigure(
      doc,
      "tri",
      "nope",
      20,
      20,
      registry(),
    );
    expect(handleId).toBeNull();
    expect(next).toBe(doc);
  });

  it("starts a segment on an existing point without adding one", () => {
    const [x, y] = pageOf("A");
    const { doc: next, handleId } = placeFigure(
      doc,
      "tri",
      "segment",
      x,
      y,
      registry(),
    );
    expect(handleId).toBe("A");
    expect(specOf(next).draft).toEqual({ tool: "segment", from: "A" });
    expect(specOf(next).objects).toHaveLength(specOf(doc).objects.length);
  });

  it("reuses A and B and does not duplicate segment c", () => {
    const [ax, ay] = pageOf("A");
    const [bx, by] = pageOf("B");
    const first = placeFigure(doc, "tri", "segment", ax, ay, registry());
    const { doc: next, handleId } = placeFigure(
      first.doc,
      "tri",
      "segment",
      bx,
      by,
      registry(),
    );
    expect(handleId).toBe("c");
    expect(specOf(next).draft).toBeUndefined();
    expect(
      specOf(next).objects.filter((obj) => obj.def[0] === "segment"),
    ).toHaveLength(3);
  });

  it("creates two points and a segment on empty clicks", () => {
    const [x1, y1] = pageAt(3, 2);
    const [x2, y2] = pageAt(3.5, 2.5);
    const first = placeFigure(doc, "tri", "segment", x1, y1, registry());
    expect(first.handleId).toBe("D");
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
    expect(specOf(next).draft).toBeUndefined();
    expect(figuresOf(next)[0]?.interaction?.handles).toEqual(
      expect.arrayContaining(["D", "E", "d"]),
    );
  });

  it("does not close a segment on the same point twice", () => {
    const [x, y] = pageOf("A");
    const first = placeFigure(doc, "tri", "segment", x, y, registry());
    const { doc: next, handleId } = placeFigure(
      first.doc,
      "tri",
      "segment",
      x,
      y,
      registry(),
    );
    expect(handleId).toBe("A");
    expect(specOf(next).draft).toEqual({ tool: "segment", from: "A" });
    expect(specOf(next).objects).toHaveLength(specOf(doc).objects.length);
  });

  it("previews a ghost segment from the draft to the cursor", () => {
    const [ax, ay] = pageOf("A");
    const first = placeFigure(doc, "tri", "segment", ax, ay, registry());
    const [x, y] = pageAt(3, 2);
    const items = previewFigure(first.doc, "tri", "segment", x, y, registry());
    const line = items.find((item) => item.op === "polyline");
    expect(line?.op).toBe("polyline");
    if (line?.op === "polyline") {
      expect(line.points[0]?.[0]).toBeCloseTo(ax);
      expect(line.points[0]?.[1]).toBeCloseTo(ay);
      expect(line.points[1]?.[0]).toBeCloseTo(x);
      expect(line.points[1]?.[1]).toBeCloseTo(y);
    }
    expect(specOf(first.doc).draft).toEqual({ tool: "segment", from: "A" });
  });

  it("snaps the ghost end to an existing point", () => {
    const [ax, ay] = pageOf("A");
    const [bx, by] = pageOf("B");
    const first = placeFigure(doc, "tri", "segment", ax, ay, registry());
    const items = previewFigure(first.doc, "tri", "segment", bx, by, registry());
    const line = items.find((item) => item.op === "polyline");
    if (line?.op === "polyline") {
      expect(line.points[1]?.[0]).toBeCloseTo(bx);
      expect(line.points[1]?.[1]).toBeCloseTo(by);
    }
  });

  it("previews a ghost point on empty canvas", () => {
    const [x, y] = pageAt(3, 2);
    const items = previewFigure(doc, "tri", "point", x, y, registry());
    const mark = items.find((item) => item.op === "circle");
    expect(mark?.op).toBe("circle");
    if (mark?.op === "circle") {
      expect(mark.cx).toBeCloseTo(x);
      expect(mark.cy).toBeCloseTo(y);
    }
    const first = previewFigure(doc, "tri", "segment", x, y, registry());
    expect(first.find((item) => item.op === "circle")).toMatchObject({
      op: "circle",
    });
  });

  it("hides the point ghost on an existing point", () => {
    const [ax, ay] = pageOf("A");
    expect(previewFigure(doc, "tri", "point", ax, ay, registry())).toEqual([]);
    const first = placeFigure(doc, "tri", "segment", ax, ay, registry());
    expect(previewFigure(first.doc, "tri", "segment", ax, ay, registry())).toEqual(
      [],
    );
  });


});
