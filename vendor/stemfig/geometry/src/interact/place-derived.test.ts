/**
 * 파생 직선·원 place / compile / hit / apply / fields.
 * fixture 시트는 추가하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE } from "@stemfig/display";
import {
  applyFigure,
  hitFigure,
  listFields,
  patchField,
  placeFigure,
  previewFigure,
} from "@stemfig/host";
import { compileGeometry } from "../compile.ts";
import { initGeometry } from "../init.ts";
import { listFeatures, pathGeomOf } from "../intersect.ts";
import { geometrySpecSchema } from "../schema.ts";
import { baseDoc, pageAt, pageOf, registry, specOf } from "./test-harness.ts";

describe("place derived edges", () => {
  it("places a parallel line from C then AB", () => {
    const [cx, cy] = pageOf(baseDoc, "C");
    const first = placeFigure(
      baseDoc,
      "tri",
      "parallel-line",
      cx,
      cy,
      registry(),
    );
    expect(specOf(first.doc).draft?.tool).toBe("parallel-line");
    const [x, y] = pageAt(first.doc, 3, 0);
    const next = placeFigure(
      first.doc,
      "tri",
      "parallel-line",
      x,
      y,
      registry(),
    );
    const line = specOf(next.doc).objects.find(
      (obj) => obj.def[0] === "parallel_line",
    );
    expect(line?.def).toEqual(["parallel_line", "C", "A", "B"]);
    const againA = placeFigure(next.doc, "tri", "parallel-line", cx, cy, registry());
    const again = placeFigure(
      againA.doc,
      "tri",
      "parallel-line",
      x,
      y,
      registry(),
    );
    expect(
      specOf(again.doc).objects.filter((obj) => obj.def[0] === "parallel_line"),
    ).toHaveLength(1);
  });

  it("places a perp line with the same (P, A, B)", () => {
    const [cx, cy] = pageOf(baseDoc, "C");
    const first = placeFigure(
      baseDoc,
      "tri",
      "perpendicular-line",
      cx,
      cy,
      registry(),
    );
    const [x, y] = pageAt(first.doc, 3, 0);
    const next = placeFigure(
      first.doc,
      "tri",
      "perpendicular-line",
      x,
      y,
      registry(),
    );
    expect(
      specOf(next.doc).objects.find((obj) => obj.def[0] === "perp_line")?.def,
    ).toEqual(["perp_line", "C", "A", "B"]);
  });

  it("places an internal bisector A V B and keeps order", () => {
    const [ax, ay] = pageOf(baseDoc, "A");
    const [vx, vy] = pageOf(baseDoc, "C");
    const [bx, by] = pageOf(baseDoc, "B");
    const first = placeFigure(
      baseDoc,
      "tri",
      "angle-bisector",
      ax,
      ay,
      registry(),
    );
    const mid = placeFigure(
      first.doc,
      "tri",
      "angle-bisector",
      vx,
      vy,
      registry(),
    );
    const next = placeFigure(
      mid.doc,
      "tri",
      "angle-bisector",
      bx,
      by,
      registry(),
    );
    expect(
      specOf(next.doc).objects.find((obj) => obj.def[0] === "bisector")?.def,
    ).toEqual(["bisector", "A", "C", "B", "internal"]);
  });

  it("reuses a circumcircle regardless of click order", () => {
    const clicks = [
      pageOf(baseDoc, "A"),
      pageOf(baseDoc, "B"),
      pageOf(baseDoc, "C"),
    ] as const;
    let doc = baseDoc;
    for (const [x, y] of clicks) {
      doc = placeFigure(doc, "tri", "circle-three-points", x, y, registry()).doc;
    }
    expect(
      specOf(doc).objects.filter((obj) => obj.def[0] === "circumcircle"),
    ).toHaveLength(1);
    const reverse = [
      pageOf(doc, "C"),
      pageOf(doc, "B"),
      pageOf(doc, "A"),
    ] as const;
    for (const [x, y] of reverse) {
      doc = placeFigure(doc, "tri", "circle-three-points", x, y, registry()).doc;
    }
    expect(
      specOf(doc).objects.filter((obj) => obj.def[0] === "circumcircle"),
    ).toHaveLength(1);
  });

  it("places an incircle on three vertices", () => {
    let doc = baseDoc;
    for (const id of ["A", "B", "C"] as const) {
      const [x, y] = pageOf(doc, id);
      doc = placeFigure(doc, "tri", "circle-incircle", x, y, registry()).doc;
    }
    expect(
      specOf(doc).objects.find((obj) => obj.def[0] === "incircle")?.def,
    ).toEqual(["incircle", "A", "B", "C"]);
  });

  it("previews a clipped parallel after the first click", () => {
    const [cx, cy] = pageOf(baseDoc, "C");
    const first = placeFigure(
      baseDoc,
      "tri",
      "parallel-line",
      cx,
      cy,
      registry(),
    );
    const [x, y] = pageAt(first.doc, 3, 0);
    const items = previewFigure(
      first.doc,
      "tri",
      "parallel-line",
      x,
      y,
      registry(),
    );
    expect(items.some((item) => item.op === "polyline")).toBe(true);
  });
});

describe("init and compile derived", () => {
  it("keeps a degenerate parallel without throwing", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "P", def: ["point", 1, 1] },
        { id: "p", def: ["parallel_line", "P", "A", "A"] },
      ],
    });
    const state = initGeometry(spec);
    expect(pathGeomOf(state.byId.get("p")!, state.points)).toBeUndefined();
    const items = compileGeometry(
      {
        frame: { x: 0, y: 0, w: 80, h: 60 },
        view: { xmin: -1, xmax: 5, ymin: -1, ymax: 5 },
        mmToPage: (x, y) => [x, y],
        style: DEFAULT_STYLE,
      },
      state,
    );
    expect(items.filter((item) => item.op === "polyline")).toHaveLength(0);
  });

  it("puts on_path on a parallel line by t", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 4, 0] },
        { id: "P", def: ["point", 0, 1] },
        { id: "p", def: ["parallel_line", "P", "A", "B"] },
        { id: "Q", def: ["on_path", "p", 0.5] },
      ],
    });
    expect(initGeometry(spec).points.get("Q")).toEqual({ x: 2, y: 1 });
  });

  it("compiles a circumcircle as a circle item", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 4, 0] },
        { id: "C", def: ["point", 0, 3] },
        { id: "k", def: ["circumcircle", "A", "B", "C"] },
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
    const ring = items.find((item) => item.op === "circle");
    expect(ring?.op).toBe("circle");
    const feats = listFeatures(spec.objects, initGeometry(spec).points);
    expect(
      feats.some((pt) => Math.abs(pt.x - 2) < 1e-9 && Math.abs(pt.y - 1.5) < 1e-9),
    ).toBe(true);
  });
});

describe("hit apply fields derived", () => {
  it("hits a parallel stroke outside handles and apply is a no-op", () => {
    const [cx, cy] = pageOf(baseDoc, "C");
    const first = placeFigure(
      baseDoc,
      "tri",
      "parallel-line",
      cx,
      cy,
      registry(),
    );
    const [sx, sy] = pageAt(first.doc, 3, 0);
    const placed = placeFigure(
      first.doc,
      "tri",
      "parallel-line",
      sx,
      sy,
      registry(),
    );
    const edge = specOf(placed.doc).objects.find(
      (obj) => obj.def[0] === "parallel_line",
    );
    const [hx, hy] = pageAt(placed.doc, 3, 3);
    expect(hitFigure(placed.doc, "tri", hx, hy, registry())).toBe(edge?.id);
    const before = specOf(placed.doc).objects;
    const next = applyFigure(
      placed.doc,
      "tri",
      { id: edge!.id, dx_mm: 8, dy_mm: 0 },
      registry(),
    );
    expect(specOf(next).objects).toEqual(before);
  });

  it("patches bisector mode and keeps refs read-only", () => {
    const [ax, ay] = pageOf(baseDoc, "A");
    const [vx, vy] = pageOf(baseDoc, "C");
    const [bx, by] = pageOf(baseDoc, "B");
    const first = placeFigure(
      baseDoc,
      "tri",
      "angle-bisector",
      ax,
      ay,
      registry(),
    );
    const mid = placeFigure(
      first.doc,
      "tri",
      "angle-bisector",
      vx,
      vy,
      registry(),
    );
    const placed = placeFigure(
      mid.doc,
      "tri",
      "angle-bisector",
      bx,
      by,
      registry(),
    );
    const edge = specOf(placed.doc).objects.find(
      (obj) => obj.def[0] === "bisector",
    )!;
    const rows = listFields(placed.doc, "tri", edge.id, registry());
    expect(rows.find((row) => row.key === "mode")).toMatchObject({
      type: "enum",
      value: "internal",
    });
    expect(rows.find((row) => row.key === "v")).toMatchObject({
      value: "C",
      disabled: true,
    });
    const next = patchField(
      placed.doc,
      "tri",
      { id: edge.id, key: "mode", value: "external" },
      registry(),
    );
    expect(
      specOf(next).objects.find((obj) => obj.id === edge.id)?.def,
    ).toEqual(["bisector", "A", "C", "B", "external"]);
  });
});
