/**
 * 공·점·포물선·각도의 HUD 손잡이.
 * 조준 손잡이는 발사 화살 끝, 최고점은 곡선에서 가장 높은 점이다.
 * 페이지 mm 만 돌려주고 드래그 의미는 apply 가 맡는다.
 */
import type { HandleAnchor } from "@stemfig/host";
import { fitView } from "@stemfig/display";
import type { CompileCtx } from "@stemfig/host";
import { referencePoint, type MechanicsState } from "../init.ts";
import { alongSamples, apexPoint, flightSteps, sampleFlight, tangentOnFlight } from "../projectile-geometry.ts";
import { rayPoint } from "../rays.ts";
import type { MechanicsObject, Vec } from "../schema.ts";

/**
 * @param object 공·점·포물선·각도
 * @param state 해석된 중심과 곡선
 * @param page 장면 → 페이지 mm
 * @param ctx 표본 수에 쓰는 배율. 없으면 손잡이만 성기게 잡는다
 * @returns 본선과 제어점. 숨김은 호출 측이 걸러 있다
 */
export function motionAnchors(object: MechanicsObject, state: MechanicsState, page: (x: number, y: number) => Vec, ctx?: CompileCtx): HandleAnchor[] {
  const point = (suffix: string, position: Vec): HandleAnchor => {
    const [x_mm, y_mm] = page(...position);
    return { id: `${object.id}:${suffix}`, kind: "point", x_mm, y_mm };
  };
  if (object.type === "ball") {
    const ball = state.balls.get(object.id);
    if (!ball) return [];
    const [cx_mm, cy_mm] = page(...ball.center);
    const east = page(ball.center[0] + ball.radius, ball.center[1]);
    const north = page(ball.center[0], ball.center[1] + ball.radius);
    return [{ id: object.id, kind: "ellipse", cx_mm, cy_mm, rx_mm: Math.abs(east[0] - cx_mm), ry_mm: Math.abs(north[1] - cy_mm) },
      point("center", ball.center)];
  }
  if (object.type === "point") return [point("at", referencePoint(object.at, state))];
  if (object.type === "angle") {
    const vertex = referencePoint(object.v, state);
    return [point("v", vertex), point("a", rayPoint(object.a, vertex, state)), point("b", rayPoint(object.b, vertex, state))];
  }
  if (object.type !== "trajectory") return [];
  const flight = state.curves.get(object.id);
  if (!flight) return [];
  const scale = ctx ? Math.max(Math.abs(fitView(ctx.view, ctx.frame).scaleX), Math.abs(fitView(ctx.view, ctx.frame).scaleY)) : 1;
  const scene = sampleFlight(flight, flightSteps(flight, scale));
  const anchors: HandleAnchor[] = [
    { id: object.id, kind: "polyline", points: scene.map((item) => page(...item)) },
    point("a", flight.a), point("b", flight.b), point("apex", apexPoint(flight)),
  ];
  if (object.launch) {
    const dir = tangentOnFlight(flight, 0);
    anchors.push(point("aim", pageLength(page, flight.a, dir, object.launch.length)));
  }
  object.arrows.forEach((fraction, index) => {
    const mark = alongSamples(scene, fraction);
    if (mark) anchors.push(point(`arrow:${index}`, mark.at));
  });
  return anchors;
}

function pageLength(page: (x: number, y: number) => Vec, origin: Vec, dir: Vec, mm: number): Vec {
  const a = page(...origin);
  const b = page(origin[0] + dir[0], origin[1] + dir[1]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!(length > 0)) return [...origin];
  /* 손잡이는 장면 좌표다. 페이지 mm 길이를 그 방향의 장면 길이로 되돌린다. */
  const scale = mm / length;
  return [origin[0] + dir[0] * scale, origin[1] + dir[1] * scale];
}
