import { describe, expect, it } from "vitest";
import { initGeometry } from "./init.ts";
import {
  isIntersectionMark,
  isMarkShown,
  isVertexMark,
} from "./mark-role.ts";
import { geometrySpecSchema } from "./schema.ts";

const hideMarks = { markPoints: false } as const;

describe("mark-role", () => {
  it("treats a free point as a vertex even when two segments meet there", () => {
    const state = initGeometry(
      geometrySpecSchema.parse({
        objects: [
          { id: "A", def: ["point", 0, 0] },
          { id: "B", def: ["point", 4, 0] },
          { id: "C", def: ["point", 1, 3] },
          { id: "c", def: ["segment", "A", "B"] },
          { id: "a", def: ["segment", "B", "C"] },
          { id: "b", def: ["segment", "C", "A"] },
        ],
      }),
    );
    const a = state.byId.get("A")!;
    expect(isVertexMark(a)).toBe(true);
    expect(isIntersectionMark(a, state.spec.objects, state.points)).toBe(false);
    expect(isMarkShown(a, { ...state.spec, ...hideMarks }, state.points)).toBe(
      false,
    );
  });

  it("treats an intersect as an intersection", () => {
    const state = initGeometry(
      geometrySpecSchema.parse({
        objects: [
          { id: "A", def: ["point", 0, 0] },
          { id: "B", def: ["point", 4, 0] },
          { id: "C", def: ["point", 1, 3] },
          { id: "M", def: ["division", "B", "C", 1, 1, "internal"] },
          { id: "N", def: ["division", "C", "A", 1, 1, "internal"] },
          { id: "am", def: ["line", "A", "M"] },
          { id: "bn", def: ["line", "B", "N"] },
          { id: "G", def: ["intersect", "am", "bn", 0] },
        ],
      }),
    );
    const g = state.byId.get("G")!;
    expect(isVertexMark(g)).toBe(false);
    expect(isIntersectionMark(g, state.spec.objects, state.points)).toBe(true);
    expect(isMarkShown(g, { ...state.spec, ...hideMarks }, state.points)).toBe(
      false,
    );
  });

  it("does not treat a perpendicular foot on one segment as an intersection", () => {
    const state = initGeometry(
      geometrySpecSchema.parse({
        objects: [
          { id: "A", def: ["point", 0, 0] },
          { id: "B", def: ["point", 4, 0] },
          { id: "C", def: ["point", 1, 3] },
          { id: "c", def: ["segment", "A", "B"] },
          { id: "H", def: ["projection", "C", "A", "B"] },
        ],
      }),
    );
    const h = state.byId.get("H")!;
    expect(isIntersectionMark(h, state.spec.objects, state.points)).toBe(false);
    expect(isMarkShown(h, { ...state.spec, ...hideMarks }, state.points)).toBe(
      true,
    );
  });

  it("treats a perpendicular foot that meets another path as an intersection", () => {
    const state = initGeometry(
      geometrySpecSchema.parse({
        objects: [
          { id: "A", def: ["point", 0, 0] },
          { id: "B", def: ["point", 4, 0] },
          { id: "C", def: ["point", 1, 3] },
          { id: "c", def: ["segment", "A", "B"] },
          { id: "H", def: ["projection", "C", "A", "B"] },
          { id: "h", def: ["segment", "C", "H"] },
        ],
      }),
    );
    const h = state.byId.get("H")!;
    expect(isIntersectionMark(h, state.spec.objects, state.points)).toBe(true);
    expect(isMarkShown(h, { ...state.spec, ...hideMarks }, state.points)).toBe(
      false,
    );
  });

  it("treats a midpoint that meets another path as an intersection", () => {
    const state = initGeometry(
      geometrySpecSchema.parse({
        objects: [
          { id: "A", def: ["point", 0, 0] },
          { id: "B", def: ["point", 4, 0] },
          { id: "C", def: ["point", 1, 3] },
          { id: "a", def: ["segment", "B", "C"] },
          { id: "M", def: ["division", "B", "C", 1, 1, "internal"] },
          { id: "am", def: ["line", "A", "M"] },
        ],
      }),
    );
    const m = state.byId.get("M")!;
    expect(isIntersectionMark(m, state.spec.objects, state.points)).toBe(true);
    expect(isMarkShown(m, { ...state.spec, ...hideMarks }, state.points)).toBe(
      false,
    );
  });

  it("does not treat a midpoint on one segment as an intersection", () => {
    const state = initGeometry(
      geometrySpecSchema.parse({
        objects: [
          { id: "A", def: ["point", 0, 0] },
          { id: "B", def: ["point", 4, 0] },
          { id: "c", def: ["segment", "A", "B"] },
          { id: "M", def: ["division", "A", "B", 1, 1, "internal"] },
        ],
      }),
    );
    const m = state.byId.get("M")!;
    expect(isIntersectionMark(m, state.spec.objects, state.points)).toBe(false);
    expect(isMarkShown(m, { ...state.spec, ...hideMarks }, state.points)).toBe(
      true,
    );
  });

  it("treats an on_path point that also meets another path as an intersection", () => {
    const state = initGeometry(
      geometrySpecSchema.parse({
        objects: [
          { id: "O", def: ["point", 0, 0] },
          { id: "R", def: ["point", 1, 0] },
          { id: "c", def: ["circle", "O", "R"] },
          { id: "D", def: ["on_path", "c", 0] },
          { id: "E", def: ["point", 2, 0] },
          { id: "p", def: ["line", "D", "E"] },
        ],
      }),
    );
    const d = state.byId.get("D")!;
    expect(isIntersectionMark(d, state.spec.objects, state.points)).toBe(true);
    expect(isMarkShown(d, { ...state.spec, ...hideMarks }, state.points)).toBe(
      false,
    );
  });

  it("does not treat an on_path point on a single circle as an intersection", () => {
    const state = initGeometry(
      geometrySpecSchema.parse({
        objects: [
          { id: "O", def: ["point", 0, 0] },
          { id: "R", def: ["point", 1, 0] },
          { id: "c", def: ["circle", "O", "R"] },
          { id: "D", def: ["on_path", "c", 0] },
        ],
      }),
    );
    const d = state.byId.get("D")!;
    expect(isIntersectionMark(d, state.spec.objects, state.points)).toBe(false);
    expect(isMarkShown(d, { ...state.spec, ...hideMarks }, state.points)).toBe(
      true,
    );
  });
});
