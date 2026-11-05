import { describe, expect, it } from "vitest";
import { compileDocument, parseDocument, Registry } from "@stemfig/host";
import fixture from "../fixtures/triangle.stemfig.json";
import { mathGeometryPlugin } from "./index.ts";

const doc = parseDocument(fixture);

function registry(): Registry {
  const next = new Registry();
  next.register(mathGeometryPlugin);
  return next;
}

describe("compileGeometry", () => {
  it("compiles the triangle fixture with items", () => {
    const list = compileDocument(doc, registry());
    expect(list.items.length).toBeGreaterThan(0);
    const group = list.items[0];
    expect(group?.op).toBe("group");
    if (group && group.op === "group") {
      expect(group.clip).toEqual({ x: 5, y: 5, w: 70, h: 50 });
      expect(group.items.length).toBeGreaterThan(0);
      const line = group.items.find((item) => item.op === "polyline");
      expect(line?.op).toBe("polyline");
      if (line && line.op === "polyline") {
        expect(line.points[0]?.length).toBe(2);
      }
    }
  });

  it("omits the point circle when mark is false and keeps the label", () => {
    const hidden = parseDocument({
      ...fixture,
      nodes: [
        {
          ...fixture.nodes[0]!,
          children: [
            {
              ...fixture.nodes[0]!.children![0]!,
              view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
              spec: {
                objects: [
                  { id: "A", def: ["point", 0, 0], label: "A", mark: false },
                ],
              },
            },
          ],
        },
      ],
    });
    const list = compileDocument(hidden, registry());
    const group = list.items[0];
    expect(group?.op).toBe("group");
    if (group?.op !== "group") {
      return;
    }
    expect(group.items.some((item) => item.op === "circle")).toBe(false);
    const text = group.items.find((item) => item.op === "text");
    expect(text && text.op === "text" ? text.text : "").toBe("A");
  });

  it("omits vertex and intersection circles when markPoints is false", () => {
    const hidden = parseDocument({
      ...fixture,
      nodes: [
        {
          ...fixture.nodes[0]!,
          children: [
            {
              ...fixture.nodes[0]!.children![0]!,
              spec: {
                ...fixture.nodes[0]!.children![0]!.spec,
                markPoints: false,
              },
            },
          ],
        },
      ],
    });
    const list = compileDocument(hidden, registry());
    const group = list.items[0];
    expect(group?.op).toBe("group");
    if (group?.op !== "group") {
      return;
    }
    const texts = group.items
      .filter((item) => item.op === "text")
      .map((item) => (item.op === "text" ? item.text : ""));
    expect(texts).toContain("A");
    expect(texts).toContain("G");
    expect(texts).toContain("H");
    /* 밑변 중점 M·수선의 발 H. 꼭짓점·교점은 숨긴다. */
    const marks = group.items.filter((item) => item.op === "circle");
    expect(marks.length).toBe(2);
  });

  it("omits the vertex circle when markPoints is false and keeps the label", () => {
    const hidden = parseDocument({
      ...fixture,
      nodes: [
        {
          ...fixture.nodes[0]!,
          children: [
            {
              ...fixture.nodes[0]!.children![0]!,
              view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
              spec: {
                markPoints: false,
                objects: [
                  { id: "A", def: ["point", 0, 0], label: "A" },
                ],
              },
            },
          ],
        },
      ],
    });
    const list = compileDocument(hidden, registry());
    const group = list.items[0];
    expect(group?.op).toBe("group");
    if (group?.op !== "group") {
      return;
    }
    expect(group.items.some((item) => item.op === "circle")).toBe(false);
    const text = group.items.find((item) => item.op === "text");
    expect(text && text.op === "text" ? text.text : "").toBe("A");
  });

  it("compiles a graph and a path as polylines", () => {
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
              view: { xmin: -2, xmax: 2, ymin: -2, ymax: 2 },
              spec: {
                objects: [
                  { id: "g", def: ["graph", "y = x"] },
                  { id: "p", def: ["path", "M 0 0 L 1 1"] },
                ],
              },
            },
          ],
        },
      ],
    });
    const list = compileDocument(doc, registry());
    const group = list.items[0];
    expect(group?.op).toBe("group");
    if (group?.op !== "group") {
      return;
    }
    const lines = group.items.filter((item) => item.op === "polyline");
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it("draws a missing-plugin box when the engine is not registered", () => {
    const list = compileDocument(doc, new Registry());
    const group = list.items[0];
    if (group && group.op === "group") {
      const text = group.items.find((item) => item.op === "text");
      expect(text && text.op === "text" ? text.text : "").toContain(
        "missing plugin: math.geometry",
      );
    }
  });
});
