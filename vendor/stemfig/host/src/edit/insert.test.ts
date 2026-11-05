import { describe, expect, it } from "vitest";
import { parseDocument } from "../envelope/document.ts";
import { findNode, rootFrames } from "../envelope/tree.ts";
import { parentOf } from "../envelope/tree.ts";
import { insertFigure, insertFrame, nextFigureId, nextFrameId } from "./insert.ts";

const doc = parseDocument({
  schema: "stemfig/v1",
  plugins: ["demo.alpha@1"],
  nodes: [
    {
      id: "sheet",
      type: "frame",
      frame: { x: 0, y: 0, w: 80, h: 60 },
      children: [
        {
          id: "a",
          type: "figure",
          kind: "demo.alpha",
          frame: { x: 5, y: 5, w: 20, h: 10 },
          view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
          spec: {},
        },
      ],
    },
  ],
});

describe("insertFrame", () => {
  it("appends an empty root sheet", () => {
    const next = insertFrame(doc, { x: 100, y: 20, w: 40, h: 30 });
    expect(rootFrames(next).map((node) => node.id)).toEqual(["sheet", "frame"]);
    expect(findNode(next, "frame")).toEqual({
      id: "frame",
      type: "frame",
      name: "Frame",
      frame: { x: 100, y: 20, w: 40, h: 30 },
      children: [],
    });
    expect(findNode(next, "a")).toEqual(findNode(doc, "a"));
  });

  it("skips a non-positive box", () => {
    expect(insertFrame(doc, { x: 0, y: 0, w: 0, h: 10 })).toBe(doc);
  });

  it("numbers colliding ids from frame_2", () => {
    const once = insertFrame(doc, { x: 0, y: 0, w: 10, h: 10 });
    const twice = insertFrame(once, { x: 1, y: 1, w: 10, h: 10 });
    expect(nextFrameId(once)).toBe("frame_2");
    expect(rootFrames(twice).map((node) => node.id)).toEqual([
      "sheet",
      "frame",
      "frame_2",
    ]);
  });
});

describe("insertFigure", () => {
  it("nests a figure under the sheet at dest", () => {
    const next = insertFigure(
      doc,
      {
        id: "fig",
        type: "figure",
        kind: "demo.alpha",
        frame: { x: 10, y: 10, w: 20, h: 15 },
        view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
        spec: {},
      },
      "sheet",
    );
    expect(parentOf(next, "fig")).toBe("sheet");
    expect(findNode(next, "fig")?.type).toBe("figure");
  });

  it("skips a colliding id", () => {
    expect(
      insertFigure(
        doc,
        {
          id: "a",
          type: "figure",
          kind: "demo.alpha",
          frame: { x: 1, y: 1, w: 2, h: 2 },
          view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
          spec: {},
        },
        "sheet",
      ),
    ).toBe(doc);
  });

  it("numbers colliding ids from fig_2", () => {
    const once = insertFigure(
      doc,
      {
        id: nextFigureId(doc),
        type: "figure",
        kind: "demo.alpha",
        frame: { x: 1, y: 1, w: 2, h: 2 },
        view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
        spec: {},
      },
      null,
    );
    expect(nextFigureId(once)).toBe("fig_2");
  });
});
