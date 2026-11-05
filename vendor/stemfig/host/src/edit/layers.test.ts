/**
 * listLayers. 플러그인 layers 만. spec 을 호스트가 열지 않는다.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseDocument } from "../envelope/document.ts";
import type { StemfigPlugin } from "../plugin/plugin.ts";
import { Registry } from "../plugin/registry.ts";
import { listLayers } from "./layers.ts";

const plugin: StemfigPlugin<{ n: number }> = {
  kind: "demo.alpha",
  version: 1,
  specSchema: z.object({ n: z.number() }),
  init: (spec) => spec,
  compile: () => [],
  layers: () => [{ id: "A", title: "A", icon: "plus", kind: "Point" }],
};

const doc = parseDocument({
  schema: "stemfig/v1",
  plugins: ["demo.alpha@1"],
  nodes: [
    {
      id: "sheet",
      type: "frame",
      frame: { x: 0, y: 0, w: 10, h: 10 },
      children: [
        {
          id: "fig",
          type: "figure",
          kind: "demo.alpha",
          frame: { x: 0, y: 0, w: 10, h: 10 },
          view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 },
          spec: { n: 1 },
        },
      ],
    },
  ],
});

describe("listLayers", () => {
  it("returns plugin rows and skips an unknown figure", () => {
    const registry = new Registry();
    registry.register(plugin);
    expect(listLayers(doc, "fig", registry)).toEqual([
      { id: "A", title: "A", icon: "plus", kind: "Point" },
    ]);
    expect(listLayers(doc, "missing", registry)).toEqual([]);
  });

  it("returns empty when the plugin has no layers hook", () => {
    const registry = new Registry();
    registry.register({ ...plugin, layers: undefined });
    expect(listLayers(doc, "fig", registry)).toEqual([]);
  });
});
