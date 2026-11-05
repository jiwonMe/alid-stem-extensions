/**
 * 경로 위 점. t 만 진실이다. x,y 는 init 이 푼다.
 * 선분은 t 를 [0,1] 로. 직선은 무한. 원은 atan2. @grida/* 금지.
 */
import type { GeometryState, Point } from "./init.ts";
import { pathOf } from "./path-of.ts";
import { project } from "./path-project.ts";

/**
 * a + t(b-a). clamp 면 선분 안으로. 직선은 t 를 자르지 않는다.
 * @param a 경로 시작
 * @param b 경로 끝
 * @param t 매개변수. 선분은 [0,1]
 * @param clamp true 면 선분
 * @returns view 좌표. spec 에 쓰지 말 것
 */
export function pointAtT(
  a: Point,
  b: Point,
  t: number,
  clamp: boolean,
): Point {
  const u = clamp ? Math.min(1, Math.max(0, t)) : t;
  return { x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y) };
}

/**
 * 중심에서 t 방향, 반지름은 원주점까지.
 * @param center 원 중심
 * @param through 원주 위 점. 반지름만 쓴다
 * @param t atan2 라디안
 * @returns view 좌표. spec 에 쓰지 말 것
 */
export function pointOnCircle(
  center: Point,
  through: Point,
  t: number,
): Point {
  const r = Math.hypot(through.x - center.x, through.y - center.y);
  return { x: center.x + r * Math.cos(t), y: center.y + r * Math.sin(t) };
}

/**
 * 경로 위 발의 t. 모르거나 끝이 없으면 undefined.
 * @param state init 상태. 경로 끝점은 이미 풀어져 있어야 한다
 * @param pathId segment / line / circle id
 * @param x 수학 view
 * @param y 수학 view
 * @returns 선분은 [0,1]. 원은 atan2. 경로를 모르면 undefined
 */
export function tAlongPath(
  state: GeometryState,
  pathId: string,
  x: number,
  y: number,
): number | undefined {
  const obj = state.byId.get(pathId);
  if (!obj) {
    return undefined;
  }
  /* kind 를 여기 나열하지 말 것. pathOf 가 경로다. */
  const geom = pathOf(obj, state.points);
  if (!geom || geom.kind === "implicit") {
    return undefined;
  }
  return project(geom, x, y).t;
}
