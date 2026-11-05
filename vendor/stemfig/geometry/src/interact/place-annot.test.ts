/**
 * 각 3클릭, 변 양 끝점 2클릭. right-triangle fixture.
 */
import { describe, expect, it } from "vitest";
import {
  applyFigure,
  compileDocument,
  hitFigure,
  listAnchors,
  listFields,
  parseDocument,
  patchField,
  placeFigure,
} from "@stemfig/host";
import { labelHandleId } from "../label-handle.ts";
import { rightSquare } from "../mark-geom.ts";
import { segmentBow } from "../seg-label-arc.ts";
import { initGeometry } from "../init.ts";
import { pageAt, pageOf, registry, rightDoc, specOf } from "./test-harness.ts";

const pointsOnlyDoc = parseDocument({
  schema: "stemfig/v1",
  plugins: ["math.geometry@1"],
  nodes: [
    {
      id: "page",
      type: "frame",
      frame: { x: 0, y: 0, w: 80, h: 60 },
      children: [
        {
          id: "pt",
          type: "figure",
          kind: "math.geometry",
          frame: { x: 5, y: 5, w: 70, h: 50 },
          view: { xmin: -0.5, xmax: 4.5, ymin: -0.5, ymax: 3.5 },
          spec: {
            objects: [
              { id: "A", def: ["point", 0, 0] },
              { id: "B", def: ["point", 4, 0] },
            ],
          },
          interaction: { handles: ["A", "B"], invariants: [] },
        },
      ],
    },
  ],
});

describe("place angle-annotation", () => {
  it("reuses n when B then A then C are clicked", () => {
    const [bx, by] = pageOf(rightDoc, "B");
    const first = placeFigure(
      rightDoc,
      "rt",
      "angle-annotation",
      bx,
      by,
      registry(),
    );
    expect(specOf(first.doc).draft?.tool).toBe("angle-annotation");
    const [ax, ay] = pageOf(rightDoc, "A");
    const mid = placeFigure(first.doc, "rt", "angle-annotation", ax, ay, registry());
    const [cx, cy] = pageOf(rightDoc, "C");
    const next = placeFigure(mid.doc, "rt", "angle-annotation", cx, cy, registry());
    expect(specOf(next.doc).angles).toHaveLength(1);
    expect(specOf(next.doc).draft).toBeUndefined();
  });

  it("builds an equal angle from three free clicks on the base triangle", () => {
    const [ax, ay] = pageOf(rightDoc, "C");
    const first = placeFigure(
      rightDoc,
      "rt",
      "angle-annotation",
      ax,
      ay,
      registry(),
    );
    const [vx, vy] = pageOf(rightDoc, "B");
    const mid = placeFigure(first.doc, "rt", "angle-annotation", vx, vy, registry());
    const [bx, by] = pageOf(rightDoc, "A");
    const next = placeFigure(mid.doc, "rt", "angle-annotation", bx, by, registry());
    const extra = specOf(next.doc).angles?.filter((item) => item.id !== "n");
    expect(extra).toHaveLength(1);
    expect(extra?.[0]?.mark).toBe("equal");
    expect(extra?.[0]?.ticks).toBe(1);
  });
});

describe("place segment-annotation", () => {
  it("reuses k when A then B are clicked", () => {
    const [ax, ay] = pageOf(rightDoc, "A");
    const first = placeFigure(
      rightDoc,
      "rt",
      "segment-annotation",
      ax,
      ay,
      registry(),
    );
    expect(specOf(first.doc).draft).toEqual({
      tool: "segment-annotation",
      from: "A",
    });
    const [bx, by] = pageOf(rightDoc, "B");
    const next = placeFigure(
      first.doc,
      "rt",
      "segment-annotation",
      bx,
      by,
      registry(),
    );
    expect(specOf(next.doc).marks).toHaveLength(1);
    expect(specOf(next.doc).draft).toBeUndefined();
  });

  it("adds a mark when C then A are clicked", () => {
    const [cx, cy] = pageOf(rightDoc, "C");
    const first = placeFigure(
      rightDoc,
      "rt",
      "segment-annotation",
      cx,
      cy,
      registry(),
    );
    const [ax, ay] = pageOf(rightDoc, "A");
    const next = placeFigure(
      first.doc,
      "rt",
      "segment-annotation",
      ax,
      ay,
      registry(),
    );
    const extra = specOf(next.doc).marks?.filter((item) => item.id !== "k");
    expect(extra).toHaveLength(1);
    expect(extra?.[0]).toMatchObject({ a: "C", b: "A" });
  });

  it("marks two endpoints when no segment object exists", () => {
    const [ax, ay] = pageOf(pointsOnlyDoc, "A");
    const first = placeFigure(
      pointsOnlyDoc,
      "pt",
      "segment-annotation",
      ax,
      ay,
      registry(),
    );
    const [bx, by] = pageOf(pointsOnlyDoc, "B");
    const next = placeFigure(
      first.doc,
      "pt",
      "segment-annotation",
      bx,
      by,
      registry(),
    );
    expect(specOf(next.doc).marks).toEqual([
      { id: "a", a: "A", b: "B", ticks: 1 },
    ]);
    const list = compileDocument(next.doc, registry());
    const group = list.items[0];
    if (group && group.op === "group") {
      const ticks = group.items.filter(
        (item) => item.op === "polyline" && item.points.length === 2,
      );
      expect(ticks.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("does not mark from a segment body click", () => {
    const [x, y] = pageAt(rightDoc, 3, 0);
    const next = placeFigure(
      rightDoc,
      "rt",
      "segment-annotation",
      x,
      y,
      registry(),
    );
    expect(specOf(next.doc).draft).toBeUndefined();
    expect(specOf(next.doc).marks).toHaveLength(1);
  });
});

describe("annot fields", () => {
  it("switches n to equal and rejects ticks 4", () => {
    const rows = listFields(rightDoc, "rt", "n", registry());
    expect(rows.find((row) => row.key === "mark")).toMatchObject({
      value: "right",
    });
    const eq = patchField(
      rightDoc,
      "rt",
      { id: "n", key: "mark", value: "equal" },
      registry(),
    );
    expect(specOf(eq).angles?.[0]?.mark).toBe("equal");
    expect(listFields(eq, "rt", "n", registry()).find((row) => row.key === "ticks")).toMatchObject({
      type: "enum",
      value: "1",
      options: [
        { value: "1", label: "1" },
        { value: "2", label: "2" },
        { value: "3", label: "3" },
      ],
    });
    const two = patchField(
      eq,
      "rt",
      { id: "n", key: "ticks", value: "2" },
      registry(),
    );
    expect(specOf(two).angles?.[0]?.ticks).toBe(2);
    const bad = patchField(
      two,
      "rt",
      { id: "n", key: "ticks", value: "4" },
      registry(),
    );
    expect(specOf(bad).angles?.[0]?.ticks).toBe(2);
    const circ = patchField(
      two,
      "rt",
      { id: "n", key: "style", value: "circle" },
      registry(),
    );
    expect(specOf(circ).angles?.[0]?.style).toBe("circle");
    expect(specOf(circ).angles?.[0]?.ticks).toBe(1);
    expect(listFields(circ, "rt", "n", registry()).find((row) => row.key === "ticks")).toBeUndefined();
    const stuck = patchField(
      circ,
      "rt",
      { id: "n", key: "ticks", value: "2" },
      registry(),
    );
    expect(specOf(stuck).angles?.[0]?.ticks).toBe(1);
  });

  it("switches k to circle marks", () => {
    const rows = listFields(rightDoc, "rt", "k", registry());
    expect(rows.find((row) => row.key === "style")).toMatchObject({
      value: "tick",
    });
    expect(rows.find((row) => row.key === "distance")).toBeUndefined();
    expect(rows.find((row) => row.key === "side")).toBeUndefined();
    const circ = patchField(
      rightDoc,
      "rt",
      { id: "k", key: "style", value: "circle" },
      registry(),
    );
    expect(specOf(circ).marks?.[0]?.style).toBe("circle");
    expect(specOf(circ).marks?.[0]?.ticks).toBe(1);
    expect(listFields(circ, "rt", "k", registry()).find((row) => row.key === "ticks")).toBeUndefined();
    expect(listFields(circ, "rt", "k", registry()).find((row) => row.key === "distance")).toBeUndefined();
    expect(listFields(circ, "rt", "k", registry()).find((row) => row.key === "side")).toBeUndefined();
    const stuck = patchField(
      circ,
      "rt",
      { id: "k", key: "ticks", value: "2" },
      registry(),
    );
    expect(specOf(stuck).marks?.[0]?.ticks).toBe(1);
    const [x, y] = pageAt(circ, 2, 0);
    expect(hitFigure(circ, "rt", x, y, registry())).toBe("k");
    const anchors = listAnchors(circ, "rt", registry()).filter(
      (item) => item.id === "k",
    );
    expect(anchors.every((item) => item.kind === "circle")).toBe(true);
  });

  it("switches k to a dashed label arc", () => {
    const named = patchField(
      rightDoc,
      "rt",
      { id: "k", key: "label", value: "4" },
      registry(),
    );
    const arc = patchField(
      named,
      "rt",
      { id: "k", key: "style", value: "arc" },
      registry(),
    );
    expect(specOf(arc).marks?.[0]).toMatchObject({ style: "arc", ticks: 1, label: "4" });
    expect(listFields(arc, "rt", "k", registry()).find((row) => row.key === "ticks")).toBeUndefined();
    expect(listFields(arc, "rt", "k", registry()).find((row) => row.key === "distance")).toMatchObject({
      type: "number",
      unit: "mm",
    });
    expect(listFields(arc, "rt", "k", registry()).find((row) => row.key === "side")).toMatchObject({
      type: "enum",
      value: "left",
    });
    const far = patchField(
      arc,
      "rt",
      { id: "k", key: "distance", value: 5 },
      registry(),
    );
    expect(specOf(far).marks?.[0]?.distance).toBe(5);
    const flipped = patchField(
      far,
      "rt",
      { id: "k", key: "side", value: "right" },
      registry(),
    );
    expect(specOf(flipped).marks?.[0]?.side).toBe("right");
    const [ax, ay] = pageOf(arc, "A");
    const [bx, by] = pageOf(arc, "B");
    const bow = segmentBow({ x: ax, y: ay }, { x: bx, y: by });
    expect(bow).toBeDefined();
    const mid = bow![Math.floor(bow!.length / 2)]!;
    expect(hitFigure(arc, "rt", mid.x, mid.y, registry())).toBe(
      labelHandleId("k"),
    );
    const away = bow![Math.floor(bow!.length / 4)]!;
    expect(hitFigure(arc, "rt", away.x, away.y, registry())).toBe("k");
    const handle = listAnchors(arc, "rt", registry()).find((item) => item.id === "k");
    expect(handle?.kind).toBe("polyline");
    const text = listAnchors(arc, "rt", registry()).find(
      (item) => item.id === labelHandleId("k"),
    );
    expect(text).toMatchObject({
      kind: "text",
      text: "4",
      owner: "k",
    });
  });
});

describe("annot apply", () => {
  it("keeps moving A when it coincides with B and drops the square", () => {
    const [ax, ay] = pageOf(rightDoc, "A");
    const [bx, by] = pageOf(rightDoc, "B");
    const next = applyFigure(
      rightDoc,
      "rt",
      { id: "A", dx_mm: bx - ax, dy_mm: by - ay },
      registry(),
    );
    expect(specOf(next).objects.find((obj) => obj.id === "A")?.def).toEqual([
      "point",
      4,
      0,
    ]);
    const g = initGeometry(specOf(next));
    expect(g.points.get("A")).toEqual({ x: 4, y: 0 });
    expect(g.spec.angles).toHaveLength(1);
    const list = compileDocument(next, registry());
    const group = list.items[0];
    if (group && group.op === "group") {
      const squares = group.items.filter(
        (item) => item.op === "polyline" && item.points.length === 3,
      );
      expect(squares).toHaveLength(0);
    }
  });

  it("hits the right-angle mark away from A", () => {
    const [ax, ay] = pageOf(rightDoc, "A");
    const [bx, by] = pageOf(rightDoc, "B");
    const [cx, cy] = pageOf(rightDoc, "C");
    const sq = rightSquare(
      { x: ax, y: ay },
      { x: bx, y: by },
      { x: cx, y: cy },
    );
    expect(sq).toBeDefined();
    const mid = {
      x: (sq![0].x + sq![1].x) / 2,
      y: (sq![0].y + sq![1].y) / 2,
    };
    expect(hitFigure(rightDoc, "rt", mid.x, mid.y, registry())).toBe("n");
  });

  it("hits the segment tick at the midpoint of AB", () => {
    const [x, y] = pageAt(rightDoc, 2, 0);
    expect(hitFigure(rightDoc, "rt", x, y, registry())).toBe("k");
  });
});
