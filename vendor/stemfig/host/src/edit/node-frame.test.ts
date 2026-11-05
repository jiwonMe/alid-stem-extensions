import { describe, expect, it } from "vitest";
import { parseDocument } from "../envelope/document.ts";
import { findNode } from "../envelope/tree.ts";
import { setNodeFrame } from "./node-frame.ts";

const doc = parseDocument({
  schema: "stemfig/v1",
  plugins: ["math.geometry@1"],
  nodes: [
    {
      id: "sheet",
      type: "frame",
      name: "Sheet",
      frame: { x: 0, y: 0, w: 80, h: 60 },
      children: [
        {
          id: "fig",
          type: "figure",
          kind: "math.geometry",
          frame: { x: 5, y: 5, w: 70, h: 50 },
          view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
          spec: { objects: [] },
        },
      ],
    },
  ],
});

describe("setNodeFrame", () => {
  it("sets a figure box without moving the sheet", () => {
    const next = setNodeFrame(doc, "fig", { x: 8, y: 6, w: 40, h: 30 });
    expect(findNode(next, "fig")?.frame).toEqual({ x: 8, y: 6, w: 40, h: 30 });
    expect(findNode(next, "sheet")?.frame).toEqual({ x: 0, y: 0, w: 80, h: 60 });
  });

  it("does not scale children when the sheet grows", () => {
    const next = setNodeFrame(doc, "sheet", { x: 0, y: 0, w: 120, h: 90 });
    expect(findNode(next, "sheet")?.frame).toEqual({ x: 0, y: 0, w: 120, h: 90 });
    expect(findNode(next, "fig")?.frame).toEqual({ x: 5, y: 5, w: 70, h: 50 });
  });

  it("rejects a zero-area box", () => {
    expect(setNodeFrame(doc, "fig", { x: 5, y: 5, w: 0, h: 50 })).toBe(doc);
  });
});
