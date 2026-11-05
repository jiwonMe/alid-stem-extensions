import { describe, expect, it } from "vitest";
import { StemfigValidationError } from "@stemfig/host";
import { initGeometry } from "./init.ts";
import { geometrySpecSchema } from "./schema.ts";

const view = { xmin: 0, xmax: 1, ymin: 0, ymax: 1 };

describe("initGeometry", () => {
  it("rejects an unknown point ref", () => {
    const spec = geometrySpecSchema.parse({
      view,
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "s", def: ["segment", "A", "Z"] },
      ],
    });
    expect(() => initGeometry(spec)).toThrow(StemfigValidationError);
    try {
      initGeometry(spec);
    } catch (error) {
      expect((error as StemfigValidationError).errors[0]?.code).toBe(
        "UNKNOWN_REF",
      );
    }
  });

  it("rejects a leftover midpoint tuple", () => {
    expect(() =>
      geometrySpecSchema.parse({
        view,
        objects: [
          { id: "A", def: ["point", 0, 0] },
          { id: "B", def: ["point", 4, 0] },
          { id: "M", def: ["midpoint", "A", "B"] },
        ],
      }),
    ).toThrow();
  });

  it("derives a 1:1 internal division as the midpoint", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 4, 2] },
        { id: "M", def: ["division", "A", "B", 1, 1, "internal"] },
      ],
    });
    expect(initGeometry(spec).points.get("M")).toEqual({ x: 2, y: 1 });
  });

  it("places a 2:1 internal division so AP:PB matches", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 6, 0] },
        { id: "P", def: ["division", "A", "B", 2, 1, "internal"] },
      ],
    });
    expect(initGeometry(spec).points.get("P")).toEqual({ x: 4, y: 0 });
  });

  it("rejects a 1:1 external division as SPEC", () => {
    const raw = {
      view,
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 4, 0] },
        { id: "P", def: ["division", "A", "B", 1, 1, "external"] },
      ],
    };
    expect(() => geometrySpecSchema.parse(raw)).toThrow();
    try {
      /* 스키마를 건너뛰고 init 계약만. 패널 no-op 이 막지 못한 경우. */
      initGeometry(raw as unknown as ReturnType<typeof geometrySpecSchema.parse>);
      expect.unreachable();
    } catch (error) {
      expect((error as StemfigValidationError).errors[0]?.code).toBe("SPEC");
    }
  });

  it("places an on_path point by t and follows the segment", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 4, 0] },
        { id: "c", def: ["segment", "A", "B"] },
        { id: "D", def: ["on_path", "c", 0.25] },
      ],
    });
    expect(initGeometry(spec).points.get("D")).toEqual({ x: 1, y: 0 });
  });

  it("accepts an empty objects as a blank figure", () => {
    const spec = geometrySpecSchema.parse({
      view,
      objects: [],
    });
    expect(initGeometry(spec).points.size).toBe(0);
  });

  it("places an on_path point on a circle by angle t", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 2, 0] },
        { id: "c", def: ["circle", "A", "B"] },
        { id: "D", def: ["on_path", "c", Math.PI / 2] },
      ],
    });
    const at = initGeometry(spec).points.get("D");
    expect(at?.x).toBeCloseTo(0);
    expect(at?.y).toBeCloseTo(2);
  });

  it("intersects two lines at one point", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 2, 0] },
        { id: "C", def: ["point", 1, -1] },
        { id: "D", def: ["point", 1, 1] },
        { id: "p", def: ["line", "A", "B"] },
        { id: "q", def: ["line", "C", "D"] },
        { id: "X", def: ["intersect", "p", "q", 0] },
      ],
    });
    expect(initGeometry(spec).points.get("X")).toEqual({ x: 1, y: 0 });
  });

  it("omits a parallel-line intersection instead of SPEC", () => {
    const spec = geometrySpecSchema.parse({
      view,
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 1, 0] },
        { id: "C", def: ["point", 0, 1] },
        { id: "D", def: ["point", 1, 1] },
        { id: "p", def: ["line", "A", "B"] },
        { id: "q", def: ["line", "C", "D"] },
        { id: "X", def: ["intersect", "p", "q", 0] },
      ],
    });
    expect(initGeometry(spec).points.has("X")).toBe(false);
  });

  it("orders line-circle hits by t and omits a missing index", () => {
    const spec0 = geometrySpecSchema.parse({
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
    const pts = initGeometry(spec0).points;
    expect(pts.get("X")).toEqual({ x: -1, y: 0 });
    expect(pts.get("Y")).toEqual({ x: 1, y: 0 });
    expect(
      initGeometry(
        geometrySpecSchema.parse({
          ...spec0,
          objects: [
            ...spec0.objects.filter((obj) => obj.id !== "Y"),
            { id: "Z", def: ["intersect", "p", "c", 2] },
          ],
        }),
      ).points.has("Z"),
    ).toBe(false);
  });

  it("omits a segment miss instead of SPEC", () => {
    const spec = geometrySpecSchema.parse({
      view,
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 1, 0] },
        { id: "C", def: ["point", 3, -1] },
        { id: "D", def: ["point", 3, 1] },
        { id: "s", def: ["segment", "A", "B"] },
        { id: "t", def: ["line", "C", "D"] },
        { id: "X", def: ["intersect", "s", "t", 0] },
      ],
    });
    expect(initGeometry(spec).points.has("X")).toBe(false);
  });

  it("projects a point onto the line AB", () => {
    const spec = geometrySpecSchema.parse({
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 4, 0] },
        { id: "C", def: ["point", 1, 3] },
        { id: "H", def: ["projection", "C", "A", "B"] },
      ],
    });
    expect(initGeometry(spec).points.get("H")).toEqual({ x: 1, y: 0 });
  });

  it("omits a projection when A equals B", () => {
    const spec = geometrySpecSchema.parse({
      view,
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "P", def: ["point", 1, 1] },
        { id: "H", def: ["projection", "P", "A", "A"] },
      ],
    });
    expect(initGeometry(spec).points.has("H")).toBe(false);
  });

  it("rejects an angle that names a missing point", () => {
    const spec = geometrySpecSchema.parse({
      view,
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 1, 0] },
      ],
      angles: [{ id: "n", a: "A", v: "A", b: "Z", mark: "right" }],
    });
    expect(() => initGeometry(spec)).toThrow(StemfigValidationError);
  });

  it("rejects a mark that names a missing point", () => {
    const spec = geometrySpecSchema.parse({
      view,
      objects: [
        { id: "A", def: ["point", 0, 0] },
      ],
      marks: [{ id: "k", a: "A", b: "Z", ticks: 1 }],
    });
    expect(() => initGeometry(spec)).toThrow(StemfigValidationError);
  });

  it("keeps a mark when the two points exist and no segment does", () => {
    const spec = geometrySpecSchema.parse({
      view,
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 1, 0] },
      ],
      marks: [{ id: "k", a: "A", b: "B", ticks: 1 }],
    });
    expect(initGeometry(spec).spec.marks).toHaveLength(1);
  });

  it("rejects an on_path that does not name a segment, line, or circle", () => {
    const spec = geometrySpecSchema.parse({
      view,
      objects: [
        { id: "A", def: ["point", 0, 0] },
        { id: "B", def: ["point", 1, 0] },
        { id: "C", def: ["point", 0, 1] },
        { id: "p", def: ["polygon", "A", "B", "C"] },
        { id: "D", def: ["on_path", "p", 0.5] },
      ],
    });
    expect(() => initGeometry(spec)).toThrow(StemfigValidationError);
  });
});
