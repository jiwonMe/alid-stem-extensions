/**
 * 각의 변을 장면 위의 한 점으로 푼다.
 * 접선은 저장된 속도가 아니라 곡선의 시작·끝 방향이다.
 * 각의 크기를 여기서 재지 않는다. 호출 측이 두 점을 비교한다.
 */
import { shorterSweep } from "@stemfig/plugin-kit";
import { referencePoint, type MechanicsState } from "./init.ts";
import { tangentOnFlight } from "./projectile-geometry.ts";
import { pointRay, type RayRef, type Vec } from "./schema.ts";

/**
 * @param ray 점 참조 또는 포물선 접선
 * @param vertex 각의 꼭짓점. 접선 방향을 여기에 붙인다
 * @param state 해석된 곡선과 연결점
 * @returns 꼭짓점에서 변 방향으로 단위 길이만큼 간 점. 접선 곡선이 없으면 꼭짓점
 */
export function rayPoint(ray: RayRef, vertex: Vec, state: MechanicsState): Vec {
  const point = pointRay(ray);
  if (point) return referencePoint(point, state);
  if (ray.mode !== "tangent") return [...vertex];
  const flight = state.curves.get(ray.trajectory);
  if (!flight) return [...vertex];
  const dir = tangentOnFlight(flight, ray.end === "start" ? 0 : flight.D);
  const length = Math.hypot(dir[0], dir[1]);
  if (!(length > 0)) return [...vertex];
  return [vertex[0] + dir[0] / length, vertex[1] + dir[1] / length];
}

/**
 * 두 변 사이 짧은 각. 장면 좌표 기준이라 늘이기 보기와 다를 수 있다.
 * @returns 도. 한 변이 0 길이면 undefined
 */
export function measuredAngle(vertex: Vec, a: Vec, b: Vec): number | undefined {
  if (Math.hypot(a[0] - vertex[0], a[1] - vertex[1]) === 0) return undefined;
  if (Math.hypot(b[0] - vertex[0], b[1] - vertex[1]) === 0) return undefined;
  const start = Math.atan2(a[1] - vertex[1], a[0] - vertex[0]);
  const end = Math.atan2(b[1] - vertex[1], b[0] - vertex[0]);
  return Math.abs(shorterSweep(start, end)) * 180 / Math.PI;
}
