import { describe, expect, it } from "vitest";
import { parseDocument } from "../envelope/document.ts";
import { findNode } from "../envelope/tree.ts";
import { isFigure } from "../envelope/node.ts";
import { setNodeAxes, setNodeGrid } from "./node-chrome.ts";

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
          frame: { x: 5, y: 5, w: 70, h: 50 },
          view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
          spec: {},
        },
      ],
    },
  ],
});

describe("setNodeGrid", () => {
  it("turns a figure grid on and off without touching the window", () => {
    const on = setNodeGrid(doc, "fig", { stepX: 2 });
    const fig = findNode(on, "fig");
    expect(fig && isFigure(fig) ? fig.grid : null).toEqual({ stepX: 2 });
    expect(fig && isFigure(fig) ? fig.view : null).toEqual({
      xmin: 0,
      xmax: 1,
      ymin: 0,
      ymax: 1,
    });
    const off = setNodeGrid(on, "fig", undefined);
    const cleared = findNode(off, "fig");
    expect(cleared && isFigure(cleared) ? cleared.grid : "missing").toBeUndefined();
  });

  it("rejects a sheet and a non-positive step", () => {
    expect(setNodeGrid(doc, "sheet", {})).toBe(doc);
    expect(setNodeGrid(doc, "fig", { stepX: 0 })).toBe(doc);
  });
});

describe("setNodeAxes", () => {
  it("stores axis labels and tick steps", () => {
    const next = setNodeAxes(doc, "fig", {
      x: { label: "x" },
      ticks: { stepX: 0.5, labels: true },
    });
    const fig = findNode(next, "fig");
    expect(fig && isFigure(fig) ? fig.axes : null).toEqual({
      x: { label: "x" },
      ticks: { stepX: 0.5, labels: true },
    });
  });
});
