/** 잠긴 봉투의 플러그인을 실행하거나 존재하지 않는 선택 손잡이를 반환하지 않게 한다. */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseDocument } from "../envelope/document.ts";
import { setNodeLocked } from "../envelope/lock.ts";
import type { StemfigPlugin } from "../plugin/plugin.ts";
import { Registry } from "../plugin/registry.ts";
import { applyFigure, placeFigure } from "./interact.ts";

const doc = parseDocument({ schema: "stemfig/v1", plugins: ["demo.alpha@1"], nodes: [{
  id: "sheet", type: "frame", frame: { x: 0, y: 0, w: 100, h: 100 }, children: [{
    id: "fig", type: "figure", kind: "demo.alpha",
    frame: { x: 10, y: 10, w: 20, h: 20 }, view: { xmin: 0, xmax: 1, ymin: 0, ymax: 1 }, spec: { n: 0 },
  }],
}] });

function hooks() {
  const init = vi.fn((spec: { n: number }) => spec);
  const place = vi.fn(() => ({ state: { n: 1 }, handles: ["new_handle"] }));
  const apply = vi.fn(() => ({ n: 2 }));
  const plugin: StemfigPlugin<{ n: number }> = {
    kind: "demo.alpha", version: 1, specSchema: z.object({ n: z.number() }),
    init, compile: () => [], toSpec: (state) => state, place, apply,
  };
  const registry = new Registry();
  registry.register(plugin);
  return { registry, init, place, apply };
}

describe("locked plugin interactions", () => {
  it.each(["fig", "sheet"])("returns no phantom handle when %s supplies the lock", (id) => {
    const locked = setNodeLocked(doc, id, true);
    const { registry, init, place, apply } = hooks();
    expect(placeFigure(locked, "fig", "point", 12, 12, registry)).toEqual({ doc: locked, handleId: null });
    expect(applyFigure(locked, "fig", { id: "old", dx_mm: 1, dy_mm: 0 }, registry)).toBe(locked);
    expect(init).not.toHaveBeenCalled();
    expect(place).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("returns new handles again after explicit unlock", () => {
    const unlocked = setNodeLocked(setNodeLocked(doc, "sheet", true), "sheet", false);
    const { registry, place } = hooks();
    const result = placeFigure(unlocked, "fig", "point", 12, 12, registry);
    expect(result.doc).not.toBe(unlocked);
    expect(result.handleId).toBe("new_handle");
    expect(place).toHaveBeenCalledOnce();
  });
});
