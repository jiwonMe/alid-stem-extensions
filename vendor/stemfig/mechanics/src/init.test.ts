/**
 * 경로 → 물체 → 주석 관계의 재계산과 오류 경계를 검증한다.
 * 선언 순서가 달라도 같은 그림을 만들어야 하며 물체의 이동을 중복 저장하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { StemfigValidationError } from "@stemfig/host";
import { initMechanics, referencePoint } from "./init.ts";
import { mechanicsSpecSchema, type MechanicsObject, type MechanicsSpec } from "./schema.ts";

function scene(objects: MechanicsObject[]): MechanicsSpec {
  return mechanicsSpecSchema.parse({ objects });
}

const track: MechanicsObject = { id: "ramp", type: "track", points: [[0, 0], [10, 10]], rounding: 0 };
const block: MechanicsObject = { id: "A", type: "block", width: 2, height: 2,
  pose: { mode: "track", track: "ramp", t: 0.5, offset: 0 } };
const force: MechanicsObject = { id: "force", type: "force", delta: [3, 0],
  from: { mode: "anchor", object: "A", anchor: "top" } };

function failureCode(spec: MechanicsSpec): string {
  try {
    initMechanics(spec);
    throw new Error("expected initialization failure");
  } catch (error) {
    expect(error).toBeInstanceOf(StemfigValidationError);
    return (error as StemfigValidationError).errors[0]!.code;
  }
}

describe("initMechanics", () => {
  it("resolves attachments regardless of declaration and drawing order", () => {
    const state = initMechanics(scene([force, block, track]));
    expect(state.poses.get("A")).toEqual({ point: [5, 5], angle: 45 });
    const anchor = referencePoint({ mode: "anchor", object: "A", anchor: "top" }, state);
    expect(anchor[0]).toBeCloseTo(5 - Math.SQRT2);
    expect(anchor[1]).toBeCloseTo(5 + Math.SQRT2);
  });

  it("recomputes a block and its annotations when the track moves", () => {
    const first = initMechanics(scene([track, block, force]));
    const moved = initMechanics(scene([{ ...track, points: [[7, 2], [17, 12]] }, block, force]));
    const ref = { mode: "anchor", object: "A", anchor: "right" } as const;
    const before = referencePoint(ref, first);
    const after = referencePoint(ref, moved);
    expect(after[0] - before[0]).toBeCloseTo(7);
    expect(after[1] - before[1]).toBeCloseTo(2);
    expect(moved.spec.objects[1]).toEqual(block);
  });

  it("applies attachment offset along the track normal", () => {
    const state = initMechanics(scene([track,
      { ...block, pose: { mode: "track", track: "ramp", t: 0.5, offset: 2 } }]));
    const at = state.poses.get("A")!;
    expect(at.angle).toBe(45);
    expect(at.point[0]).toBeCloseTo(5 - Math.SQRT2);
    expect(at.point[1]).toBeCloseTo(5 + Math.SQRT2);
  });

  it.each([
    { points: [[10, 0], [0, 0]], angle: 0, bottom: [5, 2] },
    { points: [[10, 10], [0, 0]], angle: 45, bottom: [5 - Math.SQRT2, 5 + Math.SQRT2] },
    { points: [[10, -10], [0, 0]], angle: -45, bottom: [5 + Math.SQRT2, -5 + Math.SQRT2] },
  ])("keeps blocks above a reversed track at $angle degrees", ({ points, angle, bottom }) => {
    const state = initMechanics(mechanicsSpecSchema.parse({ objects: [
      { ...track, points }, { ...block, pose: { mode: "track", track: "ramp", t: 0.5, offset: 2 } },
    ] }));
    const pose = state.poses.get("A")!;
    expect(pose.angle).toBeCloseTo(angle);
    expect(pose.point[0]).toBeCloseTo(bottom[0]!);
    expect(pose.point[1]).toBeCloseTo(bottom[1]!);
    const top = referencePoint({ mode: "anchor", object: "A", anchor: "top" }, state);
    expect(top[1]).toBeGreaterThan(pose.point[1]);
  });

  it("chooses the same side for either direction of a vertical track", () => {
    for (const points of [[[0, 0], [0, 10]], [[0, 10], [0, 0]]]) {
      const state = initMechanics(mechanicsSpecSchema.parse({ objects: [
        { ...track, points }, { ...block, pose: { mode: "track", track: "ramp", t: 0.5, offset: 1 } },
      ] }));
      expect(state.poses.get("A")!.angle).toBe(90);
      expect(state.poses.get("A")!.point[0]).toBeCloseTo(-1);
    }
  });

  it("keeps free poses at bottom center and anchor offsets in world coordinates", () => {
    const state = initMechanics(scene([{ ...block,
      pose: { mode: "free", point: [3, 4], angle: 90 } }]));
    expect(referencePoint({ mode: "anchor", object: "A", anchor: "bottom" }, state)).toEqual([3, 4]);
    const at = referencePoint({ mode: "anchor", object: "A", anchor: "top", offset: [5, 1] }, state);
    expect(at[0]).toBeCloseTo(6);
    expect(at[1]).toBeCloseTo(5);
  });

  it("rejects duplicates and zero-length tracks as SPEC", () => {
    expect(failureCode(scene([track, track]))).toBe("SPEC");
    expect(failureCode(scene([{ ...track, points: [[2, 2], [2, 2]] }]))).toBe("SPEC");
  });

  it("rejects missing and wrong-type track references", () => {
    expect(failureCode(scene([block]))).toBe("UNKNOWN_REF");
    expect(failureCode(scene([
      { id: "ramp", type: "block", width: 1, height: 1, pose: { mode: "free", point: [0, 0], angle: 0 } }, block,
    ]))).toBe("UNKNOWN_REF");
  });

  it("rejects missing and wrong-type annotation references", () => {
    expect(failureCode(scene([force]))).toBe("UNKNOWN_REF");
    expect(failureCode(scene([track, { ...force,
      from: { mode: "anchor", object: "ramp", anchor: "center" } }]))).toBe("UNKNOWN_REF");
  });

  it("accepts empty scenes and returns free reference points without aliasing", () => {
    const state = initMechanics(scene([]));
    expect(state.poses.size).toBe(0);
    const point: [number, number] = [1, 2];
    const result = referencePoint({ mode: "free", point }, state);
    result[0] = 3;
    expect(point).toEqual([1, 2]);
  });
});
