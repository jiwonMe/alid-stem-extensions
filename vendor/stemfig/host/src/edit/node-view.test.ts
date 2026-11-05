import { describe, expect, it } from "vitest";
import { parseDocument } from "../envelope/document.ts";
import { findNode } from "../envelope/tree.ts";
import { isFigure } from "../envelope/node.ts";
import { setNodeView } from "./node-view.ts";

const view = { xmin: 0, xmax: 1, ymin: 0, ymax: 1 };

const doc = parseDocument({
  schema: "stemfig/v1",
  plugins: ["math.geometry@1"],
  nodes: [
    {
      id: "sheet",
      type: "frame",
      frame: { x: 0, y: 0, w: 80, h: 60 },
      children: [
        {
          id: "fig",
          type: "figure",
          kind: "math.geometry",
          frame: { x: 5, y: 5, w: 70, h: 50 },
          view,
          spec: { objects: [] },
        },
      ],
    },
  ],
});

describe("setNodeView", () => {
  it("sets a figure window without moving the box", () => {
    const next = setNodeView(doc, "fig", { xmin: -1, xmax: 2, ymin: -1, ymax: 2 });
    const fig = findNode(next, "fig");
    expect(fig && isFigure(fig) ? fig.view : null).toEqual({
      xmin: -1,
      xmax: 2,
      ymin: -1,
      ymax: 2,
    });
    expect(fig?.frame).toEqual({ x: 5, y: 5, w: 70, h: 50 });
  });

  it("rejects a sheet", () => {
    expect(setNodeView(doc, "sheet", { xmin: 0, xmax: 2, ymin: 0, ymax: 2 })).toBe(
      doc,
    );
  });

  it("rejects a collapsed window", () => {
    expect(setNodeView(doc, "fig", { xmin: 1, xmax: 1, ymin: 0, ymax: 1 })).toBe(
      doc,
    );
  });

  it("stores stretch even when the window is unchanged", () => {
    const next = setNodeView(doc, "fig", { ...view, stretch: true });
    const fig = findNode(next, "fig");
    expect(fig && isFigure(fig) ? fig.view.stretch : undefined).toBe(true);
  });
});
