import { describe, expect, it } from "vitest";
import { parseDocument, type Document } from "../envelope/document.ts";
import { figuresOf, findNode, parentOf } from "../envelope/tree.ts";
import { translateNodes } from "./translate.ts";

const SHEET = "sheet";

const doc = parseDocument({
  schema: "stemfig/v1",
  plugins: ["demo.alpha@1"],
  nodes: [
    {
      id: SHEET,
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
        {
          id: "b",
          type: "figure",
          kind: "demo.alpha",
          frame: { x: 40, y: 20, w: 20, h: 10 },
          view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
          spec: {},
        },
      ],
    },
  ],
});

function frameOf(next: Document, id: string) {
  return findNode(next, id)?.frame;
}

describe("translateNodes", () => {
  it("moves only the named figures", () => {
    const next = translateNodes(doc, ["a"], 3, 4);
    expect(frameOf(next, "a")).toEqual({ x: 8, y: 9, w: 20, h: 10 });
    expect(frameOf(next, "b")).toEqual({ x: 40, y: 20, w: 20, h: 10 });
  });

  it("lets a figure leave its frame and attaches it to root", () => {
    const next = translateNodes(doc, ["a"], -20, 80);
    expect(frameOf(next, "a")).toEqual({ x: -15, y: 85, w: 20, h: 10 });
    expect(parentOf(next, "a")).toBeNull();
  });

  it("returns a root figure to the frame when the center comes back", () => {
    const off = translateNodes(doc, ["a"], -20, 80);
    const back = translateNodes(off, ["a"], 20, -80);
    expect(frameOf(back, "a")).toEqual({ x: 5, y: 5, w: 20, h: 10 });
    expect(parentOf(back, "a")).toBe(SHEET);
  });

  it("moves several figures in one call", () => {
    const next = translateNodes(doc, ["a", "b"], 1, 1);
    expect(frameOf(next, "a")).toEqual({ x: 6, y: 6, w: 20, h: 10 });
    expect(frameOf(next, "b")).toEqual({ x: 41, y: 21, w: 20, h: 10 });
  });

  it("takes the children along when a sheet moves", () => {
    const next = translateNodes(doc, [SHEET], 100, 0);
    expect(frameOf(next, SHEET)).toEqual({ x: 100, y: 0, w: 80, h: 60 });
    expect(frameOf(next, "a")).toEqual({ x: 105, y: 5, w: 20, h: 10 });
    expect(frameOf(next, "b")).toEqual({ x: 140, y: 20, w: 20, h: 10 });
  });

  it("keeps a moved sheet at root with its children attached", () => {
    const next = translateNodes(doc, [SHEET], 100, 0);
    expect(parentOf(next, SHEET)).toBeNull();
    expect(parentOf(next, "a")).toBe(SHEET);
    expect(figuresOf(next)).toHaveLength(2);
  });

  it("moves a child once when the sheet is dragged with it", () => {
    /* 시트가 자식을 데려가므로 자식까지 밀면 델타가 두 번 먹는다. */
    const next = translateNodes(doc, [SHEET, "a"], 10, 0);
    expect(frameOf(next, "a")).toEqual({ x: 15, y: 5, w: 20, h: 10 });
  });

  it("returns the same document when nothing moves", () => {
    expect(translateNodes(doc, ["nope"], 1, 1)).toBe(doc);
    expect(translateNodes(doc, ["a"], 0, 0)).toBe(doc);
  });
});
