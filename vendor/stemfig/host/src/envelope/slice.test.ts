import { describe, expect, it } from "vitest";
import { parseDocument } from "./document.ts";
import { sliceEnvelope, unionFrames } from "./slice.ts";

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

describe("sliceEnvelope", () => {
  it("includes child figures when a sheet is selected", () => {
    expect(sliceEnvelope(doc, ["sheet"])).toEqual({
      figureIds: ["fig"],
      sheetIds: ["sheet"],
      crop: { x: 0, y: 0, w: 80, h: 60 },
    });
  });

  it("crops to the figure when only that figure is selected", () => {
    expect(sliceEnvelope(doc, ["fig"])).toEqual({
      figureIds: ["fig"],
      sheetIds: [],
      crop: { x: 5, y: 5, w: 20, h: 10 },
    });
  });

  it("dedupes a figure already covered by its sheet", () => {
    const slice = sliceEnvelope(doc, ["sheet", "fig"]);
    expect(slice.figureIds).toEqual(["fig"]);
    expect(slice.sheetIds).toEqual(["sheet"]);
    expect(slice.crop).toEqual({ x: 0, y: 0, w: 80, h: 60 });
  });

  it("ignores unknown ids", () => {
    expect(sliceEnvelope(doc, ["ghost"])).toEqual({
      figureIds: [],
      sheetIds: [],
      crop: null,
    });
  });
});

describe("unionFrames", () => {
  it("returns null for an empty list", () => {
    expect(unionFrames([])).toBeNull();
  });
});
