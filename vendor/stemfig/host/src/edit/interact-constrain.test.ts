/**
 * Shift 는 호스트가 각도로 바꾸지 않고 place·preview 문맥에만 싣는다.
 * 플러그인 테스트가 교과 격자를 검증한다. 여기서는 전달 여부만 본다.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseDocument } from "../envelope/document.ts";
import type { PlaceCtx, StemfigPlugin } from "../plugin/plugin.ts";
import { Registry } from "../plugin/registry.ts";
import { placeFigure, previewFigure } from "./interact.ts";

const doc = parseDocument({ schema: "stemfig/v1", plugins: ["demo.alpha@1"], nodes: [{
  id: "sheet", type: "frame", frame: { x: 0, y: 0, w: 100, h: 100 }, children: [{
    id: "fig", type: "figure", kind: "demo.alpha",
    frame: { x: 10, y: 10, w: 20, h: 20 }, view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, spec: { n: 0 },
  }],
}] });

function registry() {
  const place = vi.fn((ctx: PlaceCtx) => ({ state: { n: ctx.constrain ? 1 : 0 } }));
  const preview = vi.fn(() => []);
  const plugin: StemfigPlugin<{ n: number }> = {
    kind: "demo.alpha", version: 1, specSchema: z.object({ n: z.number() }),
    init: (spec) => spec, compile: () => [], toSpec: (state) => state, place, preview,
  };
  const registered = new Registry();
  registered.register(plugin);
  return { registered, place, preview };
}

describe("constrain passthrough", () => {
  it("forwards Shift to place and preview without changing the click", () => {
    const { registered, place, preview } = registry();
    placeFigure(doc, "fig", "point", 12, 18, registered, false, 4, true);
    previewFigure(doc, "fig", "point", 12, 18, registered, true, 4, true);
    expect(place).toHaveBeenCalledWith(expect.objectContaining({ x_mm: 12, y_mm: 18, unsnap: false, constrain: true, px_per_mm: 4 }), expect.anything());
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ unsnap: true, constrain: true }), expect.anything());
  });

  it("leaves constrain false when the caller omits Shift", () => {
    const { registered, place } = registry();
    placeFigure(doc, "fig", "point", 12, 18, registered);
    expect(place).toHaveBeenCalledWith(expect.objectContaining({ constrain: false }), expect.anything());
  });
});
