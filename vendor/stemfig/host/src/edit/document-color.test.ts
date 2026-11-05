import { describe, expect, it } from "vitest";
import { parseDocument } from "../envelope/document.ts";
import { setDocumentColor } from "./document-color.ts";

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

describe("setDocumentColor", () => {
  it("sets and expands a canvas fill", () => {
    const painted = setDocumentColor(doc, "#ABC");
    expect(painted.color).toBe("#aabbcc");
    expect(painted.nodes).toBe(doc.nodes);
  });

  it("clears color with a blank and keeps a bad value", () => {
    const painted = setDocumentColor(doc, "#112233");
    const cleared = setDocumentColor(painted, "  ");
    expect(cleared.color).toBeUndefined();
    expect(setDocumentColor(painted, "red")).toBe(painted);
  });
});
