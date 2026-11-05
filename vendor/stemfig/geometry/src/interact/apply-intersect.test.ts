/**
 * 원–직선 교점이 사라져도 직선을 민다.
 * init 이 SPEC 을 던지면 applyFigure 가 문서를 되돌린다.
 */
import { describe, expect, it } from "vitest";
import { fitView } from "@stemfig/display";
import { applyGeometry } from "./apply.ts";
import { initGeometry } from "../init.ts";
import { geometrySpecSchema } from "../schema.ts";

const frame = { x: 0, y: 0, w: 80, h: 80 };
const view = { xmin: -4, xmax: 4, ymin: -4, ymax: 4 };

const spec = geometrySpecSchema.parse({
  objects: [
    { id: "O", def: ["point", 0, 0] },
    { id: "R", def: ["point", 1, 0] },
    { id: "A", def: ["point", -2, 0] },
    { id: "B", def: ["point", 2, 0] },
    { id: "c", def: ["circle", "O", "R"] },
    { id: "p", def: ["line", "A", "B"] },
    { id: "X", def: ["intersect", "p", "c", 0] },
    { id: "Y", def: ["intersect", "p", "c", 1] },
  ],
});

describe("apply past a vanishing intersection", () => {
  it("moves the line when it leaves the circle", () => {
    const state = initGeometry(spec);
    expect(state.points.get("X")).toEqual({ x: -1, y: 0 });
    const { scale } = fitView(view, frame);
    const next = applyGeometry(
      { frame, view },
      state,
      { id: "p", dx_mm: 0, dy_mm: 2 * scale },
    );
    /* dy_mm 양수는 페이지 아래 = 수학 y 음수. */
    expect(next.points.get("A")).toEqual({ x: -2, y: -2 });
    expect(next.points.get("B")).toEqual({ x: 2, y: -2 });
    expect(next.points.has("X")).toBe(false);
    expect(next.points.has("Y")).toBe(false);
  });
});
