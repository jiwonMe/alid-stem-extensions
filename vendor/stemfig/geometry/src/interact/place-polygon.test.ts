import { describe, expect, it } from "vitest";
import { placeFigure, previewFigure } from "@stemfig/host";
import { fixtureDoc, pageAt, pageOf, registry, specOf } from "./test-harness.ts";

describe("place polygon", () => {
  it("closes on the first vertex after three points", () => {
    const [ax, ay] = pageOf(fixtureDoc, "A");
    const [bx, by] = pageOf(fixtureDoc, "B");
    const [cx, cy] = pageOf(fixtureDoc, "C");
    let cur = placeFigure(fixtureDoc, "tri", "polygon", ax, ay, registry()).doc;
    expect(specOf(cur).draft).toEqual({ tool: "polygon", vertices: ["A"] });
    cur = placeFigure(cur, "tri", "polygon", bx, by, registry()).doc;
    cur = placeFigure(cur, "tri", "polygon", cx, cy, registry()).doc;
    expect(specOf(cur).draft).toEqual({
      tool: "polygon",
      vertices: ["A", "B", "C"],
    });
    const closed = placeFigure(cur, "tri", "polygon", ax, ay, registry());
    expect(specOf(closed.doc).draft).toBeUndefined();
    const poly = specOf(closed.doc).objects.find((obj) => obj.def[0] === "polygon");
    expect(poly?.def).toEqual(["polygon", "A", "B", "C"]);
    expect(closed.handleId).not.toBe(poly?.id);
  });

  it("does not close with only two vertices", () => {
    const [ax, ay] = pageOf(fixtureDoc, "A");
    const [bx, by] = pageOf(fixtureDoc, "B");
    let cur = placeFigure(fixtureDoc, "tri", "polygon", ax, ay, registry()).doc;
    cur = placeFigure(cur, "tri", "polygon", bx, by, registry()).doc;
    const again = placeFigure(cur, "tri", "polygon", ax, ay, registry());
    expect(specOf(again.doc).draft).toEqual({
      tool: "polygon",
      vertices: ["A", "B"],
    });
    expect(
      specOf(again.doc).objects.filter((obj) => obj.def[0] === "polygon"),
    ).toHaveLength(0);
  });

  it("reuses a polygon with the same cycle or reverse", () => {
    const [ax, ay] = pageOf(fixtureDoc, "A");
    const [bx, by] = pageOf(fixtureDoc, "B");
    const [cx, cy] = pageOf(fixtureDoc, "C");
    const first = closeAbc(fixtureDoc);
    let cur = placeFigure(first, "tri", "polygon", cx, cy, registry()).doc;
    cur = placeFigure(cur, "tri", "polygon", bx, by, registry()).doc;
    cur = placeFigure(cur, "tri", "polygon", ax, ay, registry()).doc;
    const again = placeFigure(cur, "tri", "polygon", cx, cy, registry());
    expect(
      specOf(again.doc).objects.filter((obj) => obj.def[0] === "polygon"),
    ).toHaveLength(1);
  });

  it("previews an open polyline through vertices", () => {
    const [ax, ay] = pageOf(fixtureDoc, "A");
    const [bx, by] = pageOf(fixtureDoc, "B");
    let cur = placeFigure(fixtureDoc, "tri", "polygon", ax, ay, registry()).doc;
    cur = placeFigure(cur, "tri", "polygon", bx, by, registry()).doc;
    const [x, y] = pageAt(cur, 2, 2);
    const items = previewFigure(cur, "tri", "polygon", x, y, registry());
    const line = items.find((item) => item.op === "polyline");
    expect(line?.op).toBe("polyline");
    if (line?.op === "polyline") {
      expect(line.points).toHaveLength(3);
    }
  });
});

function closeAbc(doc: typeof fixtureDoc) {
  const [ax, ay] = pageOf(doc, "A");
  const [bx, by] = pageOf(doc, "B");
  const [cx, cy] = pageOf(doc, "C");
  let cur = placeFigure(doc, "tri", "polygon", ax, ay, registry()).doc;
  cur = placeFigure(cur, "tri", "polygon", bx, by, registry()).doc;
  cur = placeFigure(cur, "tri", "polygon", cx, cy, registry()).doc;
  return placeFigure(cur, "tri", "polygon", ax, ay, registry()).doc;
}
