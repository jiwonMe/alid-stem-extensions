import { describe, expect, it } from "vitest";
import { figuresOf, hitFigure, placeFigure, previewFigure } from "@stemfig/host";
import { baseDoc, pageAt, pageOf, registry, specOf } from "./test-harness.ts";

describe("place division", () => {
  it("reuses M when the segment body is clicked", () => {
    const [x, y] = pageAt(baseDoc, 1, 0);
    const next = placeFigure(baseDoc, "tri", "division", x, y, registry());
    expect(specOf(next.doc).draft).toBeUndefined();
    expect(
      specOf(next.doc).objects.filter((obj) => obj.def[0] === "division"),
    ).toHaveLength(1);
    expect(next.handleId).toBeNull();
  });

  it("builds a 1:1 internal division from two free clicks", () => {
    const [x1, y1] = pageAt(baseDoc, 0.5, 1.5);
    const [x2, y2] = pageAt(baseDoc, 3, 1.5);
    const first = placeFigure(
      baseDoc,
      "tri",
      "division",
      x1,
      y1,
      registry(),
      true,
    );
    expect(specOf(first.doc).draft?.tool).toBe("division");
    expect(first.handleId).toBe("D");
    const next = placeFigure(
      first.doc,
      "tri",
      "division",
      x2,
      y2,
      registry(),
      true,
    );
    const mid = specOf(next.doc).objects.find(
      (obj) => obj.def[0] === "division" && obj.id !== "M",
    );
    expect(mid?.def).toEqual(["division", "D", "E", 1, 1, "internal"]);
    expect(next.handleId).toBe("E");
    expect(figuresOf(next.doc)[0]?.interaction?.handles).not.toContain(mid?.id);
  });

  it("reuses M from A then B and hits M for hover", () => {
    const [ax, ay] = pageOf(baseDoc, "A");
    const [bx, by] = pageOf(baseDoc, "B");
    const first = placeFigure(baseDoc, "tri", "division", ax, ay, registry());
    const next = placeFigure(first.doc, "tri", "division", bx, by, registry());
    expect(
      specOf(next.doc).objects.filter((obj) => obj.def[0] === "division"),
    ).toHaveLength(1);
    const [mx, my] = pageOf(next.doc, "M");
    expect(hitFigure(next.doc, "tri", mx, my, registry())).toBe("M");
  });

  it("previews the 1:1 internal point between draft and cursor", () => {
    const [ax, ay] = pageOf(baseDoc, "A");
    const first = placeFigure(baseDoc, "tri", "division", ax, ay, registry());
    const [bx, by] = pageOf(baseDoc, "B");
    const items = previewFigure(first.doc, "tri", "division", bx, by, registry());
    const mark = items.find((item) => item.op === "circle");
    expect(mark?.op).toBe("circle");
  });
});
