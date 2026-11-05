/**
 * 지면·공·점·포물선·각도의 클릭 상태.
 * 포물선은 위치, 방향, 도착의 세 클릭이며 각도는 draft 에만 잠시 둔다.
 * 물리량을 계산하지 않는다. 15° 격자는 Shift(constrain) 일 때만 적용한다.
 */
import { fitView, toPage } from "@stemfig/display";
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { paramOnSeg, snapRadiusMm } from "@stemfig/plugin-kit";
import { initMechanics, referencePoint, type MechanicsState } from "../init.ts";
import { apexPoint } from "../projectile-geometry.ts";
import { measuredAngle, rayPoint } from "../rays.ts";
import type { MechanicsObject, RayRef, Vec } from "../schema.ts";
import { commitObject, launchAngle, nextId, referenceAt, scenePoint, snapSegment, trackAt, withDraft } from "./shared.ts";

/**
 * @param ctx 도구와 페이지 클릭. constrain 은 Shift
 * @param state 현재 작도
 * @returns 이 모듈의 도구가 아니면 undefined. 퇴화면 현재 상태
 */
export function placeMotion(ctx: PlaceCtx, state: MechanicsState): PlaceResult<MechanicsState> | undefined {
  if (!["ground", "ball", "point", "trajectory", "angle"].includes(ctx.tool)) return undefined;
  const point = scenePoint(ctx);
  if (!point.every(Number.isFinite)) return { state };
  if (ctx.tool === "ball") return placeBall(ctx, state, point);
  if (ctx.tool === "point") return placePoint(ctx, state);
  if (ctx.tool === "ground") return placeGround(ctx, state, point);
  if (ctx.tool === "trajectory") return placeTrajectory(ctx, state, point);
  return placeAngle(ctx, state, point);
}

function placeBall(ctx: PlaceCtx, state: MechanicsState, point: Vec): PlaceResult<MechanicsState> {
  const track = trackAt(ctx, state);
  const span = Math.abs(ctx.view.xmax - ctx.view.xmin);
  const page = Math.min(Math.abs(fitView(ctx.view, ctx.frame).scaleX), Math.abs(fitView(ctx.view, ctx.frame).scaleY));
  const radius = page > 0 ? 1.5 / page : span / 40;
  return commitObject(state, { id: nextId(state, "ball"), type: "ball", radius, fill: "shade",
    pose: track ? { mode: "track", track: track.id, t: track.t, offset: 0 } : { mode: "free", point } });
}

function placePoint(ctx: PlaceCtx, state: MechanicsState): PlaceResult<MechanicsState> {
  const id = nextId(state, "point");
  const label = nextLetter(state);
  const rebound = freeTrajectoryEnd(ctx, state);
  const at = rebound ? { mode: "free" as const, point: rebound.point } : referenceAt(ctx, state);
  const created: MechanicsObject = { id, type: "point", label, at };
  if (!rebound) return commitObject(state, created);
  const objects = state.spec.objects.map((object) => object.id === rebound.id && object.type === "trajectory"
    ? { ...object, [rebound.end]: { mode: "anchor" as const, object: id, anchor: "center" as const } } : object);
  try {
    const { draft: _draft, ...spec } = state.spec;
    return { state: initMechanics({ ...spec, objects: [...objects, created] }), handles: [id] };
  } catch { return { state }; }
}

function placeGround(ctx: PlaceCtx, state: MechanicsState, point: Vec): PlaceResult<MechanicsState> {
  const draft = state.spec.draft?.tool === "ground" ? state.spec.draft : undefined;
  if (!draft) return withDraft(state, { tool: "ground", points: [point] });
  const page = toPage(ctx.view, ctx.frame)(...draft.points[draft.points.length - 1]!);
  if (Math.hypot(page[0] - ctx.x_mm, page[1] - ctx.y_mm) <= snapRadiusMm(ctx.px_per_mm)) {
    if (draft.points.length < 2) return { state };
    return commitObject(state, { id: nextId(state, "ground"), type: "track", points: draft.points, rounding: 0,
      ground: { style: "shade", side: "below", depth: 3 }, label: "지면" });
  }
  const next = snapSegment(draft.points[draft.points.length - 1]!, point, ctx.constrain);
  return withDraft(state, { ...draft, points: [...draft.points, next] });
}

function placeTrajectory(ctx: PlaceCtx, state: MechanicsState, point: Vec): PlaceResult<MechanicsState> {
  const draft = state.spec.draft?.tool === "trajectory" ? state.spec.draft : undefined;
  if (!draft) {
    const from = referenceAt(ctx, state);
    return withDraft(state, { tool: "trajectory", points: [referencePoint(from, state)], from });
  }
  const startRef = draft.from ?? { mode: "free" as const, point: draft.points[0]! };
  const start = referencePoint(startRef, state);
  if (draft.angle === undefined) {
    const angle = launchAngle(start, point, ctx.constrain);
    if (angle === undefined) return { state };
    return withDraft(state, { ...draft, angle, points: [draft.points[0]!, point] });
  }
  return commitObject(state, {
    id: nextId(state, "trajectory"), type: "trajectory", a: startRef, b: referenceAt(ctx, state),
    angle: draft.angle, dashed: true, arrows: [0.35],
    launch: { length: 6, label: "$v_0$" }, launchAngle: { auto: true, reference: true },
  });
}

function placeAngle(ctx: PlaceCtx, state: MechanicsState, point: Vec): PlaceResult<MechanicsState> {
  const draft = state.spec.draft?.tool === "angle" ? state.spec.draft : undefined;
  if (!draft) {
    const vertex = referenceAt(ctx, state);
    return withDraft(state, { tool: "angle", points: [referencePoint(vertex, state)], vertex });
  }
  const vertexRef = draft.vertex ?? { mode: "free" as const, point: draft.points[0]! };
  const vertex = referencePoint(vertexRef, state);
  const ray = chooseRay(ctx, state, vertex, point);
  if (!draft.ray) return withDraft(state, { ...draft, vertex: vertexRef, ray, points: [...draft.points, point] });
  const degrees = measuredAngle(vertex, rayPoint(draft.ray, vertex, state), rayPoint(ray, vertex, state));
  const mark = degrees !== undefined && Math.abs(degrees - 90) <= 0.5 ? "right" : "arc";
  return commitObject(state, { id: nextId(state, "angle"), type: "angle", v: vertexRef, a: draft.ray, b: ray, mark, auto: true });
}

function chooseRay(ctx: PlaceCtx, state: MechanicsState, vertex: Vec, point: Vec): RayRef {
  if (!ctx.unsnap) {
    const page = toPage(ctx.view, ctx.frame);
    const limit = snapRadiusMm(ctx.px_per_mm) * 2;
    const vertexPage = page(...vertex);
    for (const [id, flight] of state.curves) {
      const start = Math.hypot(vertexPage[0] - page(...flight.a)[0], vertexPage[1] - page(...flight.a)[1]);
      const end = Math.hypot(vertexPage[0] - page(...flight.b)[0], vertexPage[1] - page(...flight.b)[1]);
      const which = start <= limit && start <= end ? "start" : end <= limit ? "end" : undefined;
      if (!which) continue;
      const poly = [flight.a, apexPoint(flight), flight.b].map((item) => page(...item));
      const near = poly.slice(1).some((item, index) => paramOnSeg([ctx.x_mm, ctx.y_mm], { id, a: poly[index]!, b: item }).d <= limit);
      if (near) return { mode: "tangent", trajectory: id, end: which };
    }
  }
  const ref = referenceAt(ctx, state);
  return ref.mode === "free" ? { mode: "free", point } : ref;
}

function freeTrajectoryEnd(ctx: PlaceCtx, state: MechanicsState): { id: string; end: "a" | "b"; point: Vec } | undefined {
  const page = toPage(ctx.view, ctx.frame);
  let best: { id: string; end: "a" | "b"; point: Vec; distance: number } | undefined;
  const limit = snapRadiusMm(ctx.px_per_mm);
  for (const object of state.spec.objects) {
    if (object.type !== "trajectory" || object.show === false) continue;
    const flight = state.curves.get(object.id);
    if (!flight) continue;
    for (const end of ["a", "b"] as const) {
      const ref = object[end];
      if (ref.mode !== "free") continue;
      const at = page(...(end === "a" ? flight.a : flight.b));
      const distance = Math.hypot(at[0] - ctx.x_mm, at[1] - ctx.y_mm);
      if (distance <= limit && (!best || distance < best.distance)) {
        best = { id: object.id, end, point: end === "a" ? [...flight.a] : [...flight.b], distance };
      }
    }
  }
  return best;
}

function nextLetter(state: MechanicsState): string {
  const used = new Set(state.spec.objects.filter((object) => object.type === "point").map((object) => object.label));
  for (const letter of "PQRSTUVWXYZ") if (!used.has(letter)) return letter;
  return `P${nextId(state, "point").slice(5)}`;
}
