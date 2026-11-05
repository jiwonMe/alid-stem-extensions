import { describe, expect, it } from "vitest";
import { compileDocument, hitFigure, parseDocument } from "@stemfig/host";
import conic from "../../fixtures/conic.stemfig.json";
import sine from "../../fixtures/sine.stemfig.json";
import { pageAt, registry } from "./test-harness.ts";

describe("curve stroke hit", () => {
  it("hits the sine graph away from the gliders", () => {
    const doc = parseDocument(sine);
    const [x, y] = pageAt(doc, 3, Math.sin(3));
    expect(hitFigure(doc, "sine", x, y, registry())).toBe("f");
  });

  it("hits the sin(1/x) band as a filled region", () => {
    const doc = parseDocument({
      schema: "stemfig/v1",
      plugins: ["math.geometry@1"],
      nodes: [
        {
          id: "page",
          type: "frame",
          frame: { x: 0, y: 0, w: 80, h: 60 },
          children: [
            {
              id: "fig",
              type: "figure",
              kind: "math.geometry",
              frame: { x: 5, y: 5, w: 70, h: 50 },
              view: { xmin: -1, xmax: 1, ymin: -2, ymax: 2 },
              spec: {
                objects: [{ id: "g", def: ["graph", "y = sin(1/x)", -1, 1] }],
              },
            },
          ],
        },
      ],
    });
    const [x, y] = pageAt(doc, 0.02, 0);
    expect(hitFigure(doc, "fig", x, y, registry())).toBe("g");
  });

  it("hits the x = sin(1/y) band as a filled region", () => {
    const doc = parseDocument({
      schema: "stemfig/v1",
      plugins: ["math.geometry@1"],
      nodes: [
        {
          id: "page",
          type: "frame",
          frame: { x: 0, y: 0, w: 80, h: 60 },
          children: [
            {
              id: "fig",
              type: "figure",
              kind: "math.geometry",
              frame: { x: 5, y: 5, w: 70, h: 50 },
              view: { xmin: -2, xmax: 2, ymin: -1, ymax: 1 },
              spec: {
                objects: [{ id: "g", def: ["graph", "x = sin(1/y)", -1, 1] }],
              },
            },
          ],
        },
      ],
    });
    const [x, y] = pageAt(doc, 0, 0.02);
    expect(hitFigure(doc, "fig", x, y, registry())).toBe("g");
  });

  it("compiles the implicit circle as polylines", () => {
    const list = compileDocument(parseDocument(conic), registry());
    const group = list.items[0];
    expect(group?.op).toBe("group");
    if (group?.op !== "group") {
      return;
    }
    const lines = group.items.filter((item) => item.op === "polyline");
    expect(lines.length).toBeGreaterThan(0);
  });
});
