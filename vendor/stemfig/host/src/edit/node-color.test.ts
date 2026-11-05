import { describe, expect, it } from "vitest";
import { parseDocument } from "../envelope/document.ts";
import { findNode } from "../envelope/tree.ts";
import { setNodeColor } from "./node-color.ts";

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
          id: "fig",
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

describe("setNodeColor", () => {
  it("sets a sheet fill and a figure ink", () => {
    const sheet = setNodeColor(doc, "sheet", "#FEC");
    expect(findNode(sheet, "sheet")?.color).toBe("#ffeecc");
    const fig = setNodeColor(doc, "fig", "#aa0000");
    expect(findNode(fig, "fig")?.color).toBe("#aa0000");
  });

  it("clears color with a blank and keeps a bad value", () => {
    const painted = setNodeColor(doc, "sheet", "#ffffff");
    const cleared = setNodeColor(painted, "sheet", "  ");
    expect(findNode(cleared, "sheet")?.color).toBeUndefined();
    expect(setNodeColor(painted, "sheet", "red")).toBe(painted);
  });
});
