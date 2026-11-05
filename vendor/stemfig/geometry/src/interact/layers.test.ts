/**
 * 삼각형·직각 픽스처 레이어 행.
 */
import { describe, expect, it } from "vitest";
import { parseDocument } from "@stemfig/host";
import right from "../../fixtures/right-triangle.stemfig.json";
import triangle from "../../fixtures/triangle.stemfig.json";
import { initGeometry } from "../init.ts";
import { geometrySpecSchema } from "../schema.ts";
import { layersGeometry } from "./layers.ts";

function specOf(raw: unknown) {
  const doc = parseDocument(raw);
  const node = doc.nodes[0];
  if (!node || node.type !== "frame" || !node.children[0]) {
    throw new Error("fixture");
  }
  const figure = node.children[0];
  if (figure.type !== "figure") {
    throw new Error("fixture");
  }
  return geometrySpecSchema.parse(figure.spec);
}

describe("layersGeometry", () => {
  it("lists triangle objects in document order", () => {
    const rows = layersGeometry(initGeometry(specOf(triangle)));
    expect(rows.map((row) => row.id)).toEqual([
      "A",
      "B",
      "C",
      "c",
      "a",
      "b",
      "M",
      "MA",
      "MB",
      "am",
      "bm",
      "G",
      "H",
    ]);
    expect(rows[0]).toEqual({
      id: "A",
      title: "A",
      icon: "point",
      kind: "Point",
    });
    expect(rows.find((row) => row.id === "c")).toMatchObject({
      kind: "Segment",
      icon: "segment",
    });
  });

  it("appends angle and mark rows after objects", () => {
    const rows = layersGeometry(initGeometry(specOf(right)));
    expect(rows.map((row) => row.id).slice(-2)).toEqual(["n", "k"]);
    expect(rows.find((row) => row.id === "n")).toMatchObject({
      title: "n",
      kind: "Angle",
    });
    expect(rows.find((row) => row.id === "k")).toMatchObject({
      title: "4",
      kind: "Mark",
    });
  });
});
