/**
 * pointRole 표. 동작 케이스는 interact·hover-division 가 본다.
 */
import { describe, expect, it } from "vitest";
import { initGeometry } from "../init.ts";
import { geometrySpecSchema } from "../schema.ts";
import { isMovablePair, isSegHandle, pointRole } from "./free.ts";

const state = initGeometry(
  geometrySpecSchema.parse({
    objects: [
      { id: "A", def: ["point", 0, 0] },
      { id: "B", def: ["point", 4, 0] },
      { id: "c", def: ["segment", "A", "B"] },
      { id: "M", def: ["division", "A", "B", 1, 1, "internal"] },
      { id: "D", def: ["on_path", "c", 0.25] },
      { id: "E", def: ["point", 2, 2] },
      { id: "p", def: ["line", "A", "E"] },
      { id: "X", def: ["intersect", "c", "p", 0] },
      { id: "H", def: ["projection", "E", "A", "B"] },
    ],
  }),
);

const locked = new Set(["A"]);

describe("pointRole", () => {
  it("treats a free point as snap, hover, drag, and free", () => {
    expect(pointRole(state, "A", null)).toEqual({
      snap: true,
      hover: true,
      drag: true,
      free: true,
    });
  });

  it("locks hover, drag, and free when handles omit the point", () => {
    expect(pointRole(state, "B", locked)).toEqual({
      snap: true,
      hover: false,
      drag: false,
      free: false,
    });
  });

  it("lets on_path drag but not move as a free point", () => {
    expect(pointRole(state, "D", null)).toEqual({
      snap: true,
      hover: true,
      drag: true,
      free: false,
    });
  });

  it("snaps and hovers a visible division without drag", () => {
    expect(pointRole(state, "M", locked)).toEqual({
      snap: true,
      hover: true,
      drag: false,
      free: false,
    });
  });

  it("snaps a hidden division but does not hover it", () => {
    const hidden = initGeometry({
      ...state.spec,
      objects: state.spec.objects.map((obj) =>
        obj.id === "M" ? { ...obj, show: false } : obj,
      ),
    });
    expect(pointRole(hidden, "M", null)).toEqual({
      snap: true,
      hover: false,
      drag: false,
      free: false,
    });
  });

  it("treats intersect and projection like a division", () => {
    expect(pointRole(state, "X", locked)).toEqual({
      snap: true,
      hover: true,
      drag: false,
      free: false,
    });
    const hiddenH = initGeometry({
      ...state.spec,
      objects: state.spec.objects.map((obj) =>
        obj.id === "H" ? { ...obj, show: false } : obj,
      ),
    });
    expect(pointRole(hiddenH, "H", locked)).toEqual({
      snap: true,
      hover: false,
      drag: false,
      free: false,
    });
  });

  it("turns off snap when an intersection has no point", () => {
    const miss = initGeometry(
      geometrySpecSchema.parse({
        objects: [
          { id: "A", def: ["point", 0, 0] },
          { id: "B", def: ["point", 1, 0] },
          { id: "C", def: ["point", 0, 1] },
          { id: "D", def: ["point", 1, 1] },
          { id: "p", def: ["line", "A", "B"] },
          { id: "q", def: ["line", "C", "D"] },
          { id: "X", def: ["intersect", "p", "q", 0] },
        ],
      }),
    );
    expect(miss.points.has("X")).toBe(false);
    expect(pointRole(miss, "X", null)).toEqual({
      snap: false,
      hover: false,
      drag: false,
      free: false,
    });
  });

  it("selects a segment by visible ends and moves it by free ends", () => {
    expect(isSegHandle(state, "A", "B", null)).toBe(true);
    expect(isMovablePair(state, "A", "B", null)).toBe(true);
    expect(isSegHandle(state, "A", "M", null)).toBe(true);
    expect(isMovablePair(state, "A", "M", null)).toBe(false);
    expect(isMovablePair(state, "A", "D", null)).toBe(false);
  });

  it("does not select a segment whose end is hidden", () => {
    const hidden = initGeometry({
      ...state.spec,
      objects: state.spec.objects.map((obj) =>
        obj.id === "M" ? { ...obj, show: false } : obj,
      ),
    });
    expect(isSegHandle(hidden, "A", "M", null)).toBe(false);
  });
});
