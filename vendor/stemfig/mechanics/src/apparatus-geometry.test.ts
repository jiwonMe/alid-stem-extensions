/**
 * 기구의 외형보다 연결점·접선·압축 기하의 불변 조건을 검증한다.
 * SVG 명령을 그대로 복사하지 않고 실제 기하 관계로 회귀를 잡는다.
 */
import { describe, expect, it } from "vitest";
import { ropePoints, springPoints, supportCorners } from "./apparatus-geometry.ts";
import { initMechanics, referencePoint } from "./init.ts";
import { mechanicsSpecSchema, type MechanicsObject, type PointRef, type Pulley, type Vec } from "./schema.ts";

const pulley: Pulley = { id: "P", type: "pulley", center: [0, 0], radius: 1 };
const free = (point: Vec): PointRef => ({ mode: "free", point });
const init = (objects: MechanicsObject[]) => initMechanics(mechanicsSpecSchema.parse({ objects }));
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];

describe("apparatus geometry", () => {
  it.each(["cw", "ccw"] as const)("routes %s rope through tangent points with a continuous arc", wrap => {
    const a: Vec = [-5, 2], b: Vec = [3, -4];
    const points = ropePoints(a, b, wrap, pulley);
    expect(points[0]).toEqual(a);
    expect(points.at(-1)).toEqual(b);
    const entry = points[1]!, exit = points.at(-2)!;
    expect(dot(sub(entry, a), entry)).toBeCloseTo(0, 10);
    expect(dot(sub(b, exit), exit)).toBeCloseTo(0, 10);
    for (const p of points.slice(1, -1)) expect(Math.hypot(...p)).toBeCloseTo(1, 10);
    const direction = wrap === "ccw" ? 1 : -1;
    const tangent = (p: Vec): Vec => [-p[1] * direction, p[0] * direction];
    expect(dot(sub(entry, a), tangent(entry))).toBeGreaterThan(0);
    expect(dot(sub(b, exit), tangent(exit))).toBeGreaterThan(0);
    /* 경유 순서가 바뀌어도 같은 감는 방향이면 원호의 미소 회전 부호가 일정해야 한다. */
    for (let i = 1; i < points.length - 2; i += 1) {
      const p = points[i]!, q = points[i + 1]!;
      expect((p[0] * q[1] - p[1] * q[0]) * direction).toBeGreaterThanOrEqual(-1e-12);
    }
  });

  it("keeps tabletop and hanging rope segments horizontal and vertical", () => {
    const p: Pulley = { ...pulley, center: [5, 5] };
    const path = ropePoints([1, 6], [6, 1], "cw", p);
    expect(path[1]![0]).toBeCloseTo(5);
    expect(path[1]![1]).toBeCloseTo(6);
    expect(path.at(-2)![0]).toBeCloseTo(6);
    expect(path.at(-2)![1]).toBeCloseTo(5);
  });

  it("rejects internal endpoints and collapsed straight ropes but accepts rim endpoints", () => {
    expect(() => ropePoints([0, 0], [4, 0], "cw", pulley)).toThrow();
    expect(() => ropePoints([2, 2], [2, 2], "cw")).toThrow();
    expect(() => ropePoints([0, 1], [3, 0], "cw", pulley)).not.toThrow();
    expect(ropePoints([1, 2], [3, 4], "cw")).toEqual([[1, 2], [3, 4]]);
  });

  it.each([0, 31, 89, 173, 277])("does not add a full turn at a shared tangent rotated by %s degrees", angle => {
    const radians = angle * Math.PI / 180;
    const rotate = ([x, y]: Vec): Vec => [x * Math.cos(radians) - y * Math.sin(radians), x * Math.sin(radians) + y * Math.cos(radians)];
    const a = rotate([1, 0.05]), b = rotate([1, -0.05]);
    const points = ropePoints(a, b, "cw", pulley);
    expect(points).toHaveLength(4);
    expect(points[1]![0]).toBeCloseTo(Math.cos(radians), 10);
    expect(points[1]![1]).toBeCloseTo(Math.sin(radians), 10);
    expect(points[2]).toEqual(points[1]);
  });

  it("compresses springs without changing coil width/count and rotates them with endpoints", () => {
    const long = springPoints([0, 0], [0, 10], 2, 8);
    const short = springPoints([0, 0], [0, 4], 2, 8);
    expect(short).toHaveLength(long.length);
    expect(short[0]).toEqual([0, 0]);
    expect(short.at(-1)).toEqual([0, 4]);
    expect(Math.max(...short.map(p => p[0]))).toBeCloseTo(1);
    expect(Math.min(...short.map(p => p[0]))).toBeCloseTo(-1);
    const horizontal = springPoints([2, 3], [6, 3], 2, 8);
    for (const [index, point] of short.entries()) {
      expect(horizontal[index]![0]).toBeCloseTo(2 + point[1]);
      expect(horizontal[index]![1]).toBeCloseTo(3 - point[0]);
    }
    expect(() => springPoints([1, 1], [1, 1], 2, 8)).toThrow();
  });

  it("rotates a support around its contact apex and exposes matching anchors", () => {
    const support = { id: "S", type: "support", point: [2, 3], width: 4, height: 2, angle: 90 } as const;
    const state = init([{ ...support, point: [2, 3] }]);
    const corners = supportCorners(state.byId.get("S") as Extract<MechanicsObject, { type: "support" }>);
    expect(corners[0]).toEqual([2, 3]);
    expect(corners[1]![0]).toBeCloseTo(4);
    expect(corners[1]![1]).toBeCloseTo(1);
    expect(referencePoint({ mode: "anchor", object: "S", anchor: "bottom" }, state)).toEqual([4, 3]);
  });

  it("resolves new objects independent of order and recomputes attached springs and ropes", () => {
    const objects: MechanicsObject[] = [
      { id: "spring", type: "spring", a: free([0, 10]), b: { mode: "anchor", object: "A", anchor: "top" }, width: 1, coils: 8 },
      { id: "rope", type: "rope", a: { mode: "anchor", object: "A", anchor: "right" }, b: free([6, -5]), pulley: "P", wrap: "cw" },
      { id: "A", type: "block", pose: { mode: "free", point: [0, 4], angle: 0 }, width: 1, height: 1 },
      { ...pulley, center: [5, 4] },
    ];
    const state = init(objects);
    const moved = init(objects.map(o => o.type === "block" ? { ...o, pose: { mode: "free", point: [0, 2], angle: 0 } } : o));
    expect(state.paths.get("spring")!.at(-1)).toEqual([0, 5]);
    expect(moved.paths.get("spring")!.at(-1)).toEqual([0, 3]);
    expect(moved.paths.get("rope")![0]).toEqual([0.5, 2.5]);
    expect(moved.spec.objects[0]).toEqual(state.spec.objects[0]);
  });

  it("rejects missing/wrong pulley references and connections to non-anchor objects", () => {
    const rope: MechanicsObject = { id: "R", type: "rope", a: free([-3, 0]), b: free([3, 0]), pulley: "P", wrap: "cw" };
    expect(() => init([rope])).toThrow(/unknown pulley/);
    expect(() => init([rope, { id: "P", type: "track", points: [[0, 0], [1, 0]], rounding: 0 }])).toThrow(/unknown pulley/);
    expect(() => init([{ ...rope, pulley: undefined, a: { mode: "anchor", object: "R", anchor: "top" } }])).toThrow(/unknown attachment/);
    expect(mechanicsSpecSchema.safeParse({ objects: [{ id: "s", type: "spring", a: free([0, 0]), b: free([1, 0]), width: 1, coils: 2.5 }] }).success).toBe(false);
  });
});
