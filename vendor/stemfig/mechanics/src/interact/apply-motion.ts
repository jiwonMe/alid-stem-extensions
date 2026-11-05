/**
 * 공·점·포물선·각도 손잡이의 드래그.
 * 끝점 노브는 포인터로 다시 연결하고, 최고점 노브는 발사각만 되돌린다.
 * 실패한 각은 호출 측이 기존 상태를 유지하도록 원본을 돌려준다.
 */
import type { HandlePatch } from "@stemfig/host";
import { fitView } from "@stemfig/display";
import type { ApplyCtx } from "@stemfig/host";
import { snapDegrees } from "@stemfig/plugin-kit";
import { nearestOnTrack } from "../geometry.ts";
import { referencePoint, type MechanicsState } from "../init.ts";
import { alongSamples, apexPoint, flightSteps, sampleFlight, tangentFromApex } from "../projectile-geometry.ts";
import type { MechanicsObject, Vec } from "../schema.ts";
import { launchAngle, referenceAt } from "./shared.ts";

/**
 * @param ctx 봉투 좌표. 페이지 길이를 장면으로 되돌릴 때 쓴다
 * @param state 현재 작도
 * @param obj 손잡이 소유 객체
 * @param suffix id 에서 객체 이름을 뺀 부분
 * @param delta 장면 이동량
 * @param patch constrain 과 포인터
 * @returns 이 종류가 아니면 undefined. 퇴화면 원본
 */
export function applyMotion(ctx: ApplyCtx, state: MechanicsState, obj: MechanicsObject, suffix: string, delta: Vec, patch: HandlePatch): MechanicsObject | undefined {
  if (suffix.endsWith("label")) return movePartLabel(obj, suffix, patch) ?? obj;
  if (obj.type === "ball") return moveBall(state, obj, suffix, delta);
  if (obj.type === "point") return movePoint(ctx, state, obj, suffix, delta, patch);
  if (obj.type === "trajectory") return moveTrajectory(ctx, state, obj, suffix, delta, patch);
  if (obj.type === "angle") return moveAngle(ctx, state, obj, suffix, delta, patch);
  if (obj.type === "track" && suffix.startsWith("point:") && patch.constrain) return snapTrackPoint(obj, suffix, delta);
  return undefined;
}

function moveBall(state: MechanicsState, obj: Extract<MechanicsObject, { type: "ball" }>, suffix: string, delta: Vec): MechanicsObject {
  if (suffix && suffix !== "center") return obj;
  if (obj.pose.mode === "free") return { ...obj, pose: { ...obj.pose, point: add(obj.pose.point, delta) } };
  const center = state.balls.get(obj.id)?.center;
  const points = state.tracks.get(obj.pose.track);
  if (!center || !points) return obj;
  return { ...obj, pose: { ...obj.pose, t: nearestOnTrack(points, add(center, delta)).t } };
}

function movePoint(ctx: ApplyCtx, state: MechanicsState, obj: Extract<MechanicsObject, { type: "point" }>, suffix: string, delta: Vec, patch: HandlePatch): MechanicsObject {
  if (suffix && suffix !== "at") return obj;
  if (patch.pointer) return { ...obj, at: referenceAt({ ...ctx, ...patch.pointer, tool: "connect" }, state, obj.id) };
  if (obj.at.mode === "free") return { ...obj, at: { ...obj.at, point: add(obj.at.point, delta) } };
  return { ...obj, at: { ...obj.at, offset: add(obj.at.offset ?? [0, 0], delta) } };
}

function moveTrajectory(ctx: ApplyCtx, state: MechanicsState, obj: Extract<MechanicsObject, { type: "trajectory" }>, suffix: string, delta: Vec, patch: HandlePatch): MechanicsObject {
  const flight = state.curves.get(obj.id);
  if (!flight) return obj;
  if (suffix === "a" || suffix === "b") {
    const key = suffix;
    const ref = obj[key];
    const next = patch.pointer ? referenceAt({ ...ctx, ...patch.pointer, tool: "connect" }, state, obj.id) : moveBound(ref, delta);
    return { ...obj, [key]: next };
  }
  if (suffix === "aim" && obj.launch) {
    const start = referencePoint(obj.a, state);
    const aim = add(pageAim(ctx, flight.a, obj.launch.length, flight), delta);
    const angle = launchAngle(start, aim, patch.constrain);
    if (angle === undefined) return obj;
    const length = Math.max(1, Math.hypot(aim[0] - start[0], aim[1] - start[1]) * Math.abs(fitView(ctx.view, ctx.frame).scaleX));
    return { ...obj, angle, launch: { ...obj.launch, length } };
  }
  if (suffix === "apex") {
    const height = apexPoint(flight)[1] + delta[1] - flight.a[1];
    const tangent = tangentFromApex(flight, height);
    if (tangent === undefined) return obj;
    return { ...obj, angle: Math.atan(tangent) * 180 / Math.PI };
  }
  if (suffix.startsWith("arrow:")) {
    const index = Number(suffix.slice(6));
    if (!Number.isInteger(index) || !obj.arrows[index]) return obj;
    const scale = Math.max(Math.abs(fitView(ctx.view, ctx.frame).scaleX), 1e-6);
    const samples = sampleFlight(flight, flightSteps(flight, scale));
    const target = add(alongSamples(samples, obj.arrows[index]!)?.at ?? flight.a, delta);
    let best = obj.arrows[index]!;
    let distance = Infinity;
    for (let step = 0; step <= 40; step += 1) {
      const fraction = step / 40;
      const at = alongSamples(samples, fraction)?.at;
      if (!at) continue;
      const next = Math.hypot(at[0] - target[0], at[1] - target[1]);
      if (next < distance) { distance = next; best = fraction; }
    }
    return { ...obj, arrows: obj.arrows.map((value, at) => at === index ? best : value) };
  }
  if (suffix) return obj;
  return { ...obj, a: moveBound(obj.a, delta), b: moveBound(obj.b, delta) };
}

function moveAngle(ctx: ApplyCtx, state: MechanicsState, obj: Extract<MechanicsObject, { type: "angle" }>, suffix: string, delta: Vec, patch: HandlePatch): MechanicsObject {
  const rebind = (ref: typeof obj.v) => patch.pointer
    ? referenceAt({ ...ctx, ...patch.pointer, tool: "connect" }, state, obj.id) : moveBound(ref, delta);
  if (suffix === "v") return { ...obj, v: rebind(obj.v) };
  if ((suffix === "a" || suffix === "b") && obj[suffix].mode !== "tangent") return { ...obj, [suffix]: rebind(obj[suffix]) };
  if (suffix) return obj;
  return { ...obj, v: moveBound(obj.v, delta), a: obj.a.mode === "tangent" ? obj.a : moveBound(obj.a, delta), b: obj.b.mode === "tangent" ? obj.b : moveBound(obj.b, delta) };
}

function snapTrackPoint(obj: Extract<MechanicsObject, { type: "track" }>, suffix: string, delta: Vec): MechanicsObject | undefined {
  const index = Number(suffix.slice(6));
  if (!Number.isInteger(index) || index <= 0 || !obj.points[index]) return undefined;
  const next = add(obj.points[index]!, delta);
  const dx = next[0] - obj.points[index - 1]![0];
  const dy = next[1] - obj.points[index - 1]![1];
  const length = Math.hypot(dx, dy);
  const degrees = snapDegrees(Math.atan2(dy, dx) * 180 / Math.PI, 15);
  const radians = degrees * Math.PI / 180;
  const snapped: Vec = [obj.points[index - 1]![0] + Math.cos(radians) * length, obj.points[index - 1]![1] + Math.sin(radians) * length];
  return { ...obj, points: obj.points.map((point, at) => at === index ? snapped : point) };
}

function movePartLabel<T extends MechanicsObject>(obj: T, suffix: string, patch: HandlePatch): T | undefined {
  if (!suffix.endsWith("label")) return undefined;
  const dx = patch.dx_mm;
  const dy = patch.dy_mm;
  if (suffix === "label") return { ...obj, labelOffset: add(obj.labelOffset ?? [0, 0], [dx, dy]) };
  if (obj.type === "trajectory" && suffix === "launch-label" && obj.launch) return { ...obj, launch: { ...obj.launch, labelOffset: add(obj.launch.labelOffset ?? [0, 0], [dx, dy]) } };
  if (obj.type === "trajectory" && suffix === "arrival-label" && obj.arrival) return { ...obj, arrival: { ...obj.arrival, labelOffset: add(obj.arrival.labelOffset ?? [0, 0], [dx, dy]) } };
  if (obj.type === "trajectory" && suffix === "angle-label" && obj.launchAngle) return { ...obj, launchAngle: { ...obj.launchAngle, labelOffset: add(obj.launchAngle.labelOffset ?? [0, 0], [dx, dy]) } };
  if (obj.type === "trajectory" && suffix === "apex-label" && obj.apex) return { ...obj, apex: { ...obj.apex, labelOffset: add(obj.apex.labelOffset ?? [0, 0], [dx, dy]) } };
  if (obj.type === "force" && suffix === "angle-label" && obj.angleMark) return { ...obj, angleMark: { ...obj.angleMark, labelOffset: add(obj.angleMark.labelOffset ?? [0, 0], [dx, dy]) } };
  return obj;
}

function moveBound<T extends { mode: string; offset?: Vec; point?: Vec }>(ref: T, delta: Vec): T {
  if (ref.mode === "free" && ref.point) return { ...ref, point: add(ref.point, delta) };
  return { ...ref, offset: add(ref.offset ?? [0, 0], delta) };
}

function pageAim(ctx: ApplyCtx, origin: Vec, mm: number, flight: { s: number; T: number }): Vec {
  const scale = Math.abs(fitView(ctx.view, ctx.frame).scaleX) || 1;
  const dir: Vec = [flight.s, flight.T];
  const length = Math.hypot(dir[0], dir[1]) || 1;
  return [origin[0] + dir[0] / length * mm / scale, origin[1] + dir[1] / length * mm / scale];
}

function add(a: Vec, b: Vec): Vec { return [a[0] + b[0], a[1] + b[1]]; }
