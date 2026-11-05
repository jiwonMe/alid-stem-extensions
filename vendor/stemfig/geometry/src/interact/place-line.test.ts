import { describe, expect, it } from "vitest";
import { placeFigure, previewFigure } from "@stemfig/host";
import { baseDoc, pageAt, pageOf, registry, specOf } from "./test-harness.ts";

describe("place line", () => {
  it("starts a line on A and finishes on B", () => {
    const [ax, ay] = pageOf(baseDoc, "A");
    const [bx, by] = pageOf(baseDoc, "B");
    const first = placeFigure(baseDoc, "tri", "line", ax, ay, registry());
    expect(specOf(first.doc).draft).toEqual({ tool: "line", from: "A" });
    const next = placeFigure(first.doc, "tri", "line", bx, by, registry());
    expect(specOf(next.doc).draft).toBeUndefined();
    const line = specOf(next.doc).objects.find((obj) => obj.def[0] === "line");
    expect(line?.def).toEqual(["line", "A", "B"]);
    expect(line?.show).not.toBe(false);
  });

  it("reuses the same endpoints in either order", () => {
    const [ax, ay] = pageOf(baseDoc, "A");
    const [bx, by] = pageOf(baseDoc, "B");
    const first = placeFigure(baseDoc, "tri", "line", ax, ay, registry());
    const made = placeFigure(first.doc, "tri", "line", bx, by, registry());
    const againA = placeFigure(made.doc, "tri", "line", bx, by, registry());
    const again = placeFigure(againA.doc, "tri", "line", ax, ay, registry());
    expect(
      specOf(again.doc).objects.filter((obj) => obj.def[0] === "line"),
    ).toHaveLength(1);
  });

  it("keeps draft when the same point is clicked twice", () => {
    const [x, y] = pageOf(baseDoc, "A");
    const first = placeFigure(baseDoc, "tri", "line", x, y, registry());
    const next = placeFigure(first.doc, "tri", "line", x, y, registry());
    expect(specOf(next.doc).draft).toEqual({ tool: "line", from: "A" });
  });

  it("previews a rubber band after the first click", () => {
    const [ax, ay] = pageOf(baseDoc, "A");
    const first = placeFigure(baseDoc, "tri", "line", ax, ay, registry());
    const [x, y] = pageAt(first.doc, 2, 1);
    const items = previewFigure(first.doc, "tri", "line", x, y, registry());
    const rubber = items.find((item) => item.op === "polyline");
    expect(rubber?.op).toBe("polyline");
  });
});
