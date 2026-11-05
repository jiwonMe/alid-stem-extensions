/**
 * 포물선과 그 부품을 페이지 mm 로 그린다.
 * 곡선은 시작·끝·발사각의 이차식이다. 화살 길이는 페이지 mm 로 고정한다.
 * 진행 화살촉은 호 길이 비율 위치에만 둔다.
 */
import type { DisplayItem, ResolvedStyle } from "@stemfig/display";
import { sampleArcPoints, shorterSweep } from "@stemfig/plugin-kit";
import type { CompileCtx } from "@stemfig/host";
import { fitView } from "@stemfig/display";
import { arrowHead, arrowNotch, strokePath } from "./drawing.ts";
import type { MechanicsState } from "./init.ts";
import { inkWidth } from "./print-style.ts";
import { alongSamples, apexPoint, flightSteps, sampleFlight, tangentOnFlight, type Flight } from "./projectile-geometry.ts";
import type { Trajectory, Vec } from "./schema.ts";

/**
 * @param ctx 배율과 상속 스타일. 표본 수는 페이지 mm 오차로 정한다
 * @param state 해석된 곡선
 * @param object 포물선
 * @param page 장면 → 페이지 mm
 * @returns 궤적·진행 촉·발사 부품. 곡선이 없으면 빈 배열
 */
export function drawTrajectory(ctx: CompileCtx, state: MechanicsState, object: Trajectory, page: (x: number, y: number) => Vec): DisplayItem[] {
  const flight = state.curves.get(object.id);
  if (!flight) return [];
  const scale = Math.max(Math.abs(fitView(ctx.view, ctx.frame).scaleX), Math.abs(fitView(ctx.view, ctx.frame).scaleY));
  const scene = sampleFlight(flight, flightSteps(flight, scale));
  const width = inkWidth(ctx.style, "trajectory", object.weight);
  const kind = object.dash === "dot" ? "dot" : "dash";
  const items = strokePath(scene.map((point) => page(...point)), ctx.style, object.dashed !== false, width, kind);
  for (const fraction of object.arrows) {
    const mark = alongSamples(scene, fraction);
    if (!mark) continue;
    const tip = page(...mark.at);
    const back = page(mark.at[0] - mark.dir[0], mark.at[1] - mark.dir[1]);
    items.push(...arrowHead(tip, back, ctx.style));
  }
  items.push(...velocityArrow(object, flight, "launch", page, ctx.style, state));
  items.push(...velocityArrow(object, flight, "arrival", page, ctx.style, state));
  items.push(...launchAngle(object, flight, page, ctx.style));
  items.push(...apexDrop(object, flight, page, ctx.style));
  return items;
}

function velocityArrow(object: Trajectory, flight: Flight, which: "launch" | "arrival", page: (x: number, y: number) => Vec, style: ResolvedStyle, state: MechanicsState): DisplayItem[] {
  const part = which === "launch" ? object.launch : object.arrival;
  if (!part) return [];
  const dir = tangentOnFlight(flight, which === "launch" ? 0 : flight.D);
  const origin = which === "launch" ? rimStart(object.a, flight.a, dir, state) : flight.b;
  const from = page(...origin);
  const tip = addLength(page, origin, dir, part.length);
  const width = inkWidth(style, "arrow", object.weight);
  return [...strokePath([from, arrowNotch(tip, from)], style, false, width), ...arrowHead(tip, from, style)];
}

function launchAngle(object: Trajectory, flight: Flight, page: (x: number, y: number) => Vec, style: ResolvedStyle): DisplayItem[] {
  if (!object.launchAngle || Math.abs(flight.angle) < 0.5) return [];
  const origin = page(...flight.a);
  const horizontal = unitPage(page, flight.a, [flight.s, 0]);
  const launch = unitPage(page, flight.a, [flight.s, flight.T]);
  const start = Math.atan2(horizontal[1], horizontal[0]);
  const delta = shorterSweep(start, Math.atan2(launch[1], launch[0]));
  const width = inkWidth(style, "guide", object.weight);
  const arc = sampleArcPoints({ x: origin[0], y: origin[1] }, 3, start, delta, 16).map((point): Vec => [point.x, point.y]);
  const items = strokePath(arc, style, false, width);
  if (object.launchAngle.reference) {
    const end: Vec = [origin[0] + horizontal[0] * 6, origin[1] + horizontal[1] * 6];
    items.push(...strokePath([origin, end], style, true, width, "dash"));
  }
  return items;
}

function apexDrop(object: Trajectory, flight: Flight, page: (x: number, y: number) => Vec, style: ResolvedStyle): DisplayItem[] {
  if (!object.apex?.drop) return [];
  const apex = apexPoint(flight);
  if (apex[1] <= flight.a[1] + 1e-6) return [];
  const width = inkWidth(style, "guide", object.weight);
  return strokePath([page(...apex), page(apex[0], flight.a[1])], style, true, width, "dot");
}

function rimStart(ref: Trajectory["a"], origin: Vec, dir: Vec, state: MechanicsState): Vec {
  if (ref.mode !== "anchor" || ref.anchor !== "center" || ref.offset) return origin;
  const ball = state.balls.get(ref.object);
  if (!ball) return origin;
  const length = Math.hypot(dir[0], dir[1]);
  if (!(length > 0)) return origin;
  return [origin[0] + dir[0] / length * ball.radius, origin[1] + dir[1] / length * ball.radius];
}

function addLength(page: (x: number, y: number) => Vec, origin: Vec, dir: Vec, mm: number): Vec {
  const step = unitPage(page, origin, dir);
  const from = page(...origin);
  return [from[0] + step[0] * mm, from[1] + step[1] * mm];
}

function unitPage(page: (x: number, y: number) => Vec, origin: Vec, dir: Vec): Vec {
  const a = page(...origin);
  const b = page(origin[0] + dir[0], origin[1] + dir[1]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return length < 1e-9 ? [1, 0] : [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
}

/**
 * 공 중심에서 나가는 힘 화살은 테두리에서 시작한다.
 * @param from 연결 참조
 * @param origin 해석된 시작
 * @param delta 장면 화살 성분
 * @param state 공 반지름
 */
export function forceOrigin(from: Trajectory["a"], origin: Vec, delta: Vec, state: MechanicsState): Vec {
  return rimStart(from, origin, delta, state);
}
