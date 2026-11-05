import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { compileDocument } from "./compile.ts";
import { parseDocument } from "../envelope/document.ts";
import type { StemfigPlugin } from "../plugin/plugin.ts";
import { Registry } from "../plugin/registry.ts";

const demoPlugin: StemfigPlugin<{ n: number }> = {
  kind: "demo.alpha",
  version: 1,
  specSchema: z.object({ n: z.number() }),
  init: (spec) => spec,
  compile: () => [
    {
      op: "circle",
      cx: 10,
      cy: 10,
      r: 2,
      stroke: "#111111",
      width: 0.35,
    },
  ],
};

const sheetBox = { x: 0, y: 0, w: 80, h: 60 };
const frame = { x: 5, y: 5, w: 70, h: 50 };

function figure(kind: string, spec: unknown, box = frame, id = "a") {
  return {
    id,
    type: "figure",
    kind,
    frame: box,
    view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
    spec,
  };
}

/** 시트 하나에 figure 하나. root 노드를 주면 그것만 시트 밖에 둔다. */
function doc(
  kind: string,
  spec: unknown,
  options?: { plugins?: string[]; roots?: unknown[] },
) {
  const roots = options?.roots ?? [];
  return parseDocument({
    schema: "stemfig/v1",
    plugins: options?.plugins ?? [`${kind}@1`],
    nodes: [
      {
        id: "sheet",
        type: "frame",
        frame: sheetBox,
        children: roots.length === 0 ? [figure(kind, spec)] : [],
      },
      ...roots,
    ],
  });
}

describe("compileDocument", () => {
  it("takes the canvas size from the only frame", () => {
    const registry = new Registry();
    registry.register(demoPlugin);
    const list = compileDocument(doc("demo.alpha", { n: 1 }), registry);
    expect(list.width_mm).toBe(80);
    expect(list.height_mm).toBe(60);
    expect(list.frames).toEqual([sheetBox]);
  });

  it("puts the frame color on the sheet fill and the figure color on ink", () => {
    const compile = vi.fn(demoPlugin.compile);
    const registry = new Registry();
    registry.register({ ...demoPlugin, compile });
    const list = compileDocument(
      parseDocument({
        schema: "stemfig/v1",
        plugins: ["demo.alpha@1"],
        nodes: [
          {
            id: "sheet",
            type: "frame",
            color: "#ffeecc",
            frame: sheetBox,
            children: [{ ...figure("demo.alpha", { n: 1 }), color: "#aa0000" }],
          },
        ],
      }),
      registry,
    );
    expect(list.frames[0]).toEqual({ ...sheetBox, fill: "#ffeecc" });
    expect(compile.mock.calls[0]?.[0]).toMatchObject({
      style: { stroke: "#aa0000", textFill: "#aa0000" },
    });
  });

  it("covers every frame with the canvas and ships their boxes", () => {
    const registry = new Registry();
    registry.register(demoPlugin);
    const list = compileDocument(
      doc("demo.alpha", { n: 1 }, {
        roots: [
          {
            id: "sheet_b",
            type: "frame",
            frame: { x: 100, y: 20, w: 80, h: 60 },
            children: [figure("demo.alpha", { n: 1 }, { x: 105, y: 25, w: 10, h: 10 }, "b")],
          },
        ],
      }),
      registry,
    );
    expect(list.width_mm).toBe(180);
    expect(list.height_mm).toBe(80);
    expect(list.frames).toHaveLength(2);
  });

  it("clips each figure with its own frame, not the first one", () => {
    const registry = new Registry();
    registry.register(demoPlugin);
    const list = compileDocument(
      doc("demo.alpha", { n: 1 }, {
        roots: [
          {
            id: "sheet_b",
            type: "frame",
            frame: { x: 100, y: 0, w: 80, h: 60 },
            children: [figure("demo.alpha", { n: 1 }, { x: 105, y: 5, w: 10, h: 10 }, "b")],
          },
        ],
      }),
      registry,
    );
    const group = list.items[0];
    expect(group?.op === "group" ? group.clip : null).toEqual({
      x: 105,
      y: 5,
      w: 10,
      h: 10,
    });
  });

  it("compiles a figure whose frame is outside every sheet", () => {
    const registry = new Registry();
    registry.register(demoPlugin);
    const list = compileDocument(
      doc("demo.alpha", { n: 1 }, {
        roots: [figure("demo.alpha", { n: 1 }, { x: 90, y: -4, w: 10, h: 10 })],
      }),
      registry,
    );
    expect(list.items[0]).toMatchObject({ op: "group" });
  });

  it("draws envelope chrome under the plugin items", () => {
    const registry = new Registry();
    registry.register(demoPlugin);
    const list = compileDocument(
      parseDocument({
        schema: "stemfig/v1",
        plugins: ["demo.alpha@1"],
        nodes: [
          {
            id: "sheet",
            type: "frame",
            frame: sheetBox,
            children: [
              {
                ...figure("demo.alpha", { n: 1 }),
                view: { xmin: -1, xmax: 1, ymin: -1, ymax: 1 },
                grid: {},
                axes: { x: { label: "x" } },
              },
            ],
          },
        ],
      }),
      registry,
    );
    const group = list.items[0];
    if (group && group.op === "group") {
      const first = group.items[0];
      expect(first && first.op === "polyline" ? first.stroke : null).toBe("#cccccc");
      expect(group.items.some((item) => item.op === "text" && item.text === "$x$")).toBe(
        true,
      );
      expect(group.items.some((item) => item.op === "circle")).toBe(true);
    }
  });

  it("delegates compile to a registered plugin", () => {
    const compile = vi.fn(demoPlugin.compile);
    const registry = new Registry();
    registry.register({ ...demoPlugin, compile });
    const list = compileDocument(doc("demo.alpha", { n: 1 }), registry);
    expect(compile).toHaveBeenCalledOnce();
    expect(list.items).toHaveLength(1);
    const group = list.items[0];
    if (group && group.op === "group") {
      expect(group.clip).toEqual(frame);
      expect(group.items[0]).toMatchObject({ op: "circle", cx: 10 });
    }
  });

  it("declares clip as figure ∩ sheet and keeps plugin items raw", () => {
    const compile = () => [
      {
        op: "polyline" as const,
        points: [
          [0, 10],
          [80, 10],
        ] as [number, number][],
        stroke: "#111111",
        width: 0.35,
      },
      {
        op: "circle" as const,
        cx: 2,
        cy: 10,
        r: 1,
        stroke: "#111111",
        width: 0.35,
      },
    ];
    const registry = new Registry();
    registry.register({ ...demoPlugin, compile });
    const list = compileDocument(doc("demo.alpha", { n: 1 }), registry);
    const group = list.items[0];
    if (group && group.op === "group") {
      expect(group.clip).toEqual(frame);
      const line = group.items.find((item) => item.op === "polyline");
      expect(line && line.op === "polyline" ? line.points : null).toEqual([
        [0, 10],
        [80, 10],
      ]);
      expect(group.items.some((item) => item.op === "circle")).toBe(true);
    }
  });

  it("declares a root figure clip as its own frame", () => {
    const compile = () => [
      {
        op: "polyline" as const,
        points: [
          [-25, 10],
          [20, 10],
        ] as [number, number][],
        stroke: "#111111",
        width: 0.35,
      },
    ];
    const registry = new Registry();
    registry.register({ ...demoPlugin, compile });
    const list = compileDocument(
      doc("demo.alpha", { n: 1 }, {
        roots: [figure("demo.alpha", { n: 1 }, { x: -20, y: 5, w: 10, h: 10 })],
      }),
      registry,
    );
    const group = list.items[0];
    if (group && group.op === "group") {
      expect(group.clip).toEqual({ x: -20, y: 5, w: 10, h: 10 });
      const line = group.items[0];
      expect(line && line.op === "polyline" ? line.points : null).toEqual([
        [-25, 10],
        [20, 10],
      ]);
    }
  });

  it("draws a missing-plugin box without throwing", () => {
    const registry = new Registry();
    const list = compileDocument(doc("demo.beta", {}), registry);
    expect(list.items).toHaveLength(1);
    const group = list.items[0];
    expect(group?.op).toBe("group");
    if (group && group.op === "group") {
      const text = group.items.find((item) => item.op === "text");
      expect(text && text.op === "text" ? text.text : "").toContain(
        "missing plugin: demo.beta",
      );
    }
  });

  it("draws an error box when specSchema fails", () => {
    const registry = new Registry();
    registry.register(demoPlugin);
    const list = compileDocument(doc("demo.alpha", { n: "bad" }), registry);
    const group = list.items[0];
    if (group && group.op === "group") {
      const text = group.items.find((item) => item.op === "text");
      expect(text && text.op === "text" ? text.text : "").toBe("error: SPEC");
    }
  });
});
