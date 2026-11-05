/**
 * 포물선은 끝점을 지나고 발사 접선이 저장 각도와 같아야 한다.
 * 속도와 중력은 이 계산에 없다.
 */
import { describe, expect, it } from "vitest";
import { apexPoint, pointOnFlight, solveFlight, tangentFromApex, tangentOnFlight } from "./projectile-geometry.ts";

describe("solveFlight", () => {
  const flight = solveFlight([0, 0], [4, 0], 60)!;

  it("passes through both ends and matches the launch tangent", () => {
    expect(pointOnFlight(flight, 0)).toEqual([0, 0]);
    expect(pointOnFlight(flight, flight.D)[0]).toBeCloseTo(4);
    expect(pointOnFlight(flight, flight.D)[1]).toBeCloseTo(0);
    const dir = tangentOnFlight(flight, 0);
    expect(Math.atan2(dir[1], dir[0]) * 180 / Math.PI).toBeCloseTo(60);
  });

  it("inverts an interior apex back to the same tangent", () => {
    const apex = apexPoint(flight);
    const tangent = tangentFromApex(flight, apex[1] - flight.a[1]);
    expect(Math.atan(tangent!) * 180 / Math.PI).toBeCloseTo(60);
  });

  it("rejects a launch that cannot reach the end and a vertical pair", () => {
    expect(solveFlight([0, 2], [4, 0], -30)).toBeUndefined();
    expect(solveFlight([1, 0], [1, 4], 45)).toBeUndefined();
  });

  it("keeps a leftward launch on the negative side", () => {
    const left = solveFlight([4, 0], [0, 0], 45)!;
    expect(left.s).toBe(-1);
    expect(pointOnFlight(left, left.D)[0]).toBeCloseTo(0);
    expect(apexPoint(left)[0]).toBeLessThan(4);
  });
});
