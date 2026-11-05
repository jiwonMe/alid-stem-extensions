/**
 * 경로의 호 길이·투영과 물체 바닥 기준 회전을 검증한다.
 * 모서리 둥글림이 교재의 수평 높이를 넘어가지 않는지를 실제 좌표로 확인한다.
 */
import { describe, expect, it } from "vitest";
import { StemfigValidationError } from "@stemfig/host";
import { blockCorners, nearestOnTrack, pointOnTrack, sampleTrack } from "./geometry.ts";
import type { Block, Track, Vec } from "./schema.ts";

const block: Block = { id: "A", type: "block", width: 4, height: 2,
  pose: { mode: "free", point: [3, 4], angle: 90 } };

describe("mechanics geometry", () => {
  it("uses accumulated distance rather than vertex count for t", () => {
    const points: Vec[] = [[0, 0], [3, 0], [3, 9]];
    expect(pointOnTrack(points, 0.5)).toEqual({ point: [3, 3], angle: 90 });
    expect(pointOnTrack(points, -1)).toEqual({ point: [0, 0], angle: 0 });
    expect(pointOnTrack(points, 2)).toEqual({ point: [3, 9], angle: 90 });
  });

  it("projects onto the closest segment and returns its whole-track t", () => {
    const result = nearestOnTrack([[0, 0], [3, 0], [3, 9]], [5, 6]);
    expect(result).toEqual({ point: [3, 6], t: 0.75, distance: 2 });
    expect(pointOnTrack([[0, 0], [3, 0], [3, 9]], result.t).point).toEqual(result.point);
  });

  it("clamps projection to track endpoints", () => {
    expect(nearestOnTrack([[0, 0], [5, 0]], [-2, 3]))
      .toEqual({ point: [0, 0], t: 0, distance: Math.hypot(2, 3) });
    expect(nearestOnTrack([[0, 0], [5, 0]], [7, 0]))
      .toEqual({ point: [5, 0], t: 1, distance: 2 });
  });

  it("rounds inside adjacent segments and preserves a flat plateau", () => {
    const track: Track = { id: "ramp", type: "track", rounding: 1,
      points: [[0, 0], [4, 4], [12, 4], [16, 8]] };
    const points = sampleTrack(track);
    expect(points[0]).toEqual([0, 0]);
    expect(points.at(-1)).toEqual([16, 8]);
    expect(points).toContainEqual([5, 4]);
    expect(points).toContainEqual([11, 4]);
    expect(points.filter(([x]) => x >= 5 && x <= 11).every(([, y]) => y === 4)).toBe(true);
    expect(points.filter(([x]) => x <= 5).every(([, y]) => y <= 4)).toBe(true);
    expect(points.filter(([x]) => x >= 11).every(([, y]) => y >= 4)).toBe(true);
    expect(track.points).toEqual([[0, 0], [4, 4], [12, 4], [16, 8]]);
  });

  it("limits large rounding to half of each adjacent segment", () => {
    const points = sampleTrack({ id: "ramp", type: "track", rounding: 100,
      points: [[0, 0], [2, 0], [2, 2], [4, 2]] });
    expect(points).toContainEqual([1, 0]);
    expect(points).toContainEqual([2, 1]);
    expect(points).toContainEqual([3, 2]);
    expect(points.every(([x, y]) => x >= 0 && x <= 4 && y >= 0 && y <= 2)).toBe(true);
    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]![0]).toBeGreaterThanOrEqual(points[index - 1]![0]);
      expect(points[index]![1]).toBeGreaterThanOrEqual(points[index - 1]![1]);
    }
  });

  it("ignores repeated vertices but rejects a wholly degenerate track", () => {
    expect(sampleTrack({ id: "ramp", type: "track", rounding: 0,
      points: [[0, 0], [0, 0], [3, 0]] })).toEqual([[0, 0], [3, 0]]);
    expect(() => sampleTrack({ id: "ramp", type: "track", rounding: 1,
      points: [[2, 2], [2, 2]] })).toThrow(StemfigValidationError);
    expect(() => nearestOnTrack([[1, 1]], [0, 0])).toThrow(StemfigValidationError);
  });

  it("rotates a rectangle around its bottom center, not its center", () => {
    const corners = blockCorners(block, { point: [3, 4], angle: 90 });
    const expected: Vec[] = [[3, 2], [3, 6], [1, 6], [1, 2]];
    for (let index = 0; index < expected.length; index += 1) {
      expect(corners[index]![0]).toBeCloseTo(expected[index]![0]);
      expect(corners[index]![1]).toBeCloseTo(expected[index]![1]);
    }
  });
});
