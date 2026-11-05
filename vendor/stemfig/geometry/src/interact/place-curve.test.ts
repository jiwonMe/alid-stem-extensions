import { describe, expect, it } from "vitest";
import { parseDocument, placeFigure } from "@stemfig/host";
import triangle from "../../fixtures/triangle.stemfig.json";
import { registry, specOf } from "./test-harness.ts";

describe("placeCurve", () => {
  it("places a seed graph on one click", () => {
    const next = placeFigure(
      parseDocument(triangle),
      "tri",
      "graph",
      10,
      10,
      registry(),
    );
    const graph = specOf(next.doc).objects.find((obj) => obj.def[0] === "graph");
    expect(graph?.def).toEqual(["graph", "y = sin(x)"]);
    expect(next.handleId).toBe(graph?.id);
  });

  it("places a seed path at the click", () => {
    const next = placeFigure(
      parseDocument(triangle),
      "tri",
      "path",
      10,
      10,
      registry(),
    );
    const path = specOf(next.doc).objects.find((obj) => obj.def[0] === "path");
    expect(path?.def[0]).toBe("path");
    expect(typeof path?.def[1]).toBe("string");
    expect(String(path?.def[1]).startsWith("M ")).toBe(true);
  });
});
