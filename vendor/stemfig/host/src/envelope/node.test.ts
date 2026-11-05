import { describe, expect, it } from "vitest";
import {
  isFigure,
  isFrameNode,
  type Figure,
  type FrameNode,
  type Node,
} from "./node.ts";

const figure: Figure = {
  id: "a",
  type: "figure",
  kind: "demo.alpha",
  frame: { x: 5, y: 5, w: 20, h: 10 },
  view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
  spec: {},
};

const sheet: FrameNode = {
  id: "sheet",
  type: "frame",
  frame: { x: 0, y: 0, w: 80, h: 60 },
  children: [figure],
};

describe("Node", () => {
  it("lets Figure and FrameNode share id and frame", () => {
    const asNode: Node = figure;
    expect(asNode.id).toBe("a");
    expect(asNode.frame).toEqual(figure.frame);
    expect(sheet.frame.w).toBe(80);
  });

  it("splits the union on type, not on a kind key", () => {
    expect(isFigure(figure)).toBe(true);
    expect(isFigure(sheet)).toBe(false);
    expect(isFrameNode(sheet)).toBe(true);
    expect(isFrameNode(figure)).toBe(false);
  });
});
