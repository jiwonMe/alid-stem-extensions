/**
 * 실 도구의 도르래 선택과 기본 감기 방향. 화면의 원주 선택을 원본 도르래 id로 바꾼다.
 * 접선 기하는 apparatus-geometry에 맡기고 UI·시뮬레이션을 가져오지 않는다.
 */
import { fitView, toPage } from "@stemfig/display";
import type { PlaceCtx } from "@stemfig/host";
import { snapRadiusMm } from "@stemfig/plugin-kit";
import { pulleyCircle, ropePoints } from "../apparatus-geometry.ts";
import { nearestOnTrack } from "../geometry.ts";
import type { MechanicsState } from "../init.ts";
import type { Pulley, Rope, Vec } from "../schema.ts";

/**
 * @param ctx 페이지 포인터와 Alt @param state 표시 중인 작도
 * @returns 가장 가까운 도르래 원주. Alt·중심·반경 밖이면 undefined다.
 */
export function pulleyAt(ctx: PlaceCtx, state: MechanicsState): Pulley | undefined {
  if (ctx.unsnap) return undefined;
  const page = toPage(ctx.view, ctx.frame);
  const scale = fitView(ctx.view, ctx.frame);
  let distance = Infinity;
  let result: Pulley | undefined;
  for (const obj of state.spec.objects) {
    if (obj.type !== "pulley" || obj.show === false) continue;
    const near = nearestOnTrack(pulleyCircle(obj).map(point => page(...point)), [ctx.x_mm, ctx.y_mm]);
    /* 작은 바퀴의 중심을 원주로 오인하지 않도록 화면상 짧은 반지름의 절반까지 허용한다. */
    const radius = Math.min(snapRadiusMm(ctx.px_per_mm), obj.radius * Math.min(scale.scaleX, scale.scaleY) / 2);
    if (near.distance <= radius && near.distance < distance) { result = obj; distance = near.distance; }
  }
  return result;
}

/**
 * 접선 길이는 방향에 무관하므로 전체 길이를 비교하면 짧은 원호를 고를 수 있다.
 * @param a 시작점 @param b 끝점 @param pulley 경유 도르래
 * @returns 더 짧은 유효 방향. 동률은 cw. 두 후보가 모두 불가능하면 undefined다.
 */
export function shortestWrap(a: Vec, b: Vec, pulley: Pulley): Rope["wrap"] | undefined {
  let best: { wrap: Rope["wrap"]; length: number } | undefined;
  for (const wrap of ["cw", "ccw"] as const) {
    try {
      const points = ropePoints(a, b, wrap, pulley);
      const length = points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index]![0], point[1] - points[index]![1]), 0);
      if (!best || length < best.length) best = { wrap, length };
    } catch { /* 원 안의 끝점은 새 문서로 저장하지 않는다. */ }
  }
  return best?.wrap;
}
