/**
 * 역학 편집의 좌표 변환과 연결점 선택.
 * 페이지 mm는 경계에서만 읽고 spec에는 y-up 장면 좌표를 쓴다.
 * 화면 자석 반경은 plugin-kit이 소유하며 교과별 픽셀 상수를 만들지 않는다.
 */
import { fitView, toPage } from "@stemfig/display";
import type { ApplyCtx, PlaceCtx, PlaceResult } from "@stemfig/host";
import { snapDegrees, snapRadiusMm } from "@stemfig/plugin-kit";
import { nearestOnTrack } from "../geometry.ts";
import { initMechanics, referencePoint, type MechanicsState } from "../init.ts";
import { pointRay, type MechanicsObject, type PointRef, type RayRef, type Vec } from "../schema.ts";

/** @param ctx 페이지 클릭과 봉투 @returns y-up 장면 좌표. 유효한 봉투만 받는다. */
export function scenePoint(ctx: ApplyCtx & { x_mm: number; y_mm: number }): Vec {
  return fitView(ctx.view, ctx.frame).fromLocal(ctx.x_mm - ctx.frame.x, ctx.y_mm - ctx.frame.y);
}

/** @param id 내부 손잡이 @returns 소유 객체 id. ':'는 spec id에 허용되지 않는다. */
export function ownerId(id: string): string { return id.split(":")[0]!; }

/** @param id 손잡이 @param handles 봉투의 편집 허용 목록 @returns 목록이 없으면 모두 허용한다. */
export function allowedHandle(id: string, handles?: string[]): boolean {
  return !handles || handles.includes(id) || handles.includes(ownerId(id));
}

/** @param state 현재 작도 @param prefix 도구 id @returns figure 내부에서 충돌하지 않는 새 id. */
export function nextId(state: MechanicsState, prefix: string): string {
  let index = 1;
  while (state.byId.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

/**
 * 경로 샘플을 페이지에 투영한 뒤 자석 거리를 비교한다. stretch에서도 화면 거리 기준이다.
 * @param ctx 클릭 위치와 줌 @param state 현재 작도 @param exclude 건너뛸 경로
 * @returns 부착할 경로와 장면 t. 반경 밖이거나 Alt이면 undefined.
 */
export function trackAt(ctx: PlaceCtx, state: MechanicsState, exclude?: string) {
  if (ctx.unsnap) return undefined;
  const page = toPage(ctx.view, ctx.frame);
  let best: { id: string; t: number; point: Vec; distance: number } | undefined;
  for (const [id, points] of state.tracks) {
    if (id === exclude || state.byId.get(id)?.show === false) continue;
    const near = nearestOnTrack(points.map((p) => page(...p)), [ctx.x_mm, ctx.y_mm]);
    if (near.distance > snapRadiusMm(ctx.px_per_mm) || (best && best.distance <= near.distance)) continue;
    const point = fitView(ctx.view, ctx.frame).fromLocal(near.point[0] - ctx.frame.x, near.point[1] - ctx.frame.y);
    /* 투영 후 호 길이 비율은 stretch에서 달라진다. 원본 경로에 다시 내려 t를 구한다. */
    best = { id, point, t: nearestOnTrack(points, point).t, distance: near.distance };
  }
  return best;
}

/**
 * 물체·도르래·받침대의 연결점 가까이에서 클릭하면 좌표 대신 참조를 저장한다.
 * @param ctx 클릭과 Alt @param state 현재 작도 @param exclude 자기 자신은 연결하지 않는다.
 * @returns 연결점 또는 자유 좌표. 없는 객체를 새로 만들지 않는다.
 */
export function referenceAt(ctx: PlaceCtx, state: MechanicsState, exclude?: string): PointRef {
  const free: PointRef = { mode: "free", point: scenePoint(ctx) };
  if (ctx.unsnap) return free;
  const page = toPage(ctx.view, ctx.frame);
  let distance = snapRadiusMm(ctx.px_per_mm);
  let result: PointRef = free;
  for (const obj of state.spec.objects) {
    if (obj.show === false || obj.id === exclude) continue;
    for (const anchor of anchorNames(obj)) {
      const ref: PointRef = { mode: "anchor", object: obj.id, anchor };
      const at = page(...referencePoint(ref, state));
      const next = Math.hypot(at[0] - ctx.x_mm, at[1] - ctx.y_mm);
      if (next <= distance) { result = ref; distance = next; }
    }
    if (obj.type !== "track") continue;
    obj.points.forEach((point, index) => {
      const at = page(...point);
      const next = Math.hypot(at[0] - ctx.x_mm, at[1] - ctx.y_mm);
      if (next <= distance) {
        result = { mode: "vertex", track: obj.id, index };
        distance = next;
      }
    });
  }
  return result;
}

function anchorNames(obj: MechanicsObject): Extract<PointRef, { mode: "anchor" }>["anchor"][] {
  if (obj.type === "point") return ["center"];
  if (obj.type === "trajectory") return ["start", "end", "apex"];
  if (obj.type === "block" || obj.type === "pulley" || obj.type === "support" || obj.type === "ball") {
    return ["center", "top", "bottom", "left", "right"];
  }
  return [];
}

/** @param obj 작도 객체 @returns 연결점 참조 목록. 경로 부착과 접선은 dependencyIds 가 더한다. */
export function objectRefs(obj: MechanicsObject): PointRef[] {
  switch (obj.type) {
    case "force": return [obj.from];
    case "dimension": case "guide": case "spring": case "rope": return [obj.a, obj.b];
    case "label": case "point": return [obj.at];
    case "trajectory": return [obj.a, obj.b];
    case "angle": return [obj.v, pointRay(obj.a), pointRay(obj.b)].filter((item): item is PointRef => item !== undefined);
    default: return [];
  }
}

/**
 * 삭제 때 함께 지울 대상 id. 꼭짓점·접선·경로 부착을 포함한다.
 * @param obj 작도 객체
 * @returns 참조된 객체 id. 자유 좌표는 빠진다
 */
export function dependencyIds(obj: MechanicsObject): string[] {
  const ids: string[] = [];
  const take = (ref: PointRef | RayRef) => {
    if (ref.mode === "anchor") ids.push(ref.object);
    if (ref.mode === "vertex") ids.push(ref.track);
    if (ref.mode === "tangent") ids.push(ref.trajectory);
  };
  for (const ref of objectRefs(obj)) take(ref);
  if (obj.type === "angle") take(obj.a), take(obj.b);
  if ((obj.type === "block" || obj.type === "ball") && obj.pose.mode === "track") ids.push(obj.pose.track);
  if (obj.type === "rope" && obj.pulley) ids.push(obj.pulley);
  return ids;
}

/**
 * Shift 가 켜지면 이전 점과의 각을 15° 격자에 맞추고 거리는 유지한다.
 * @param from 이전 장면 점
 * @param to 클릭 장면 점
 * @param constrain 호스트가 전달한 Shift. 꺼져 있으면 to 를 그대로 둔다
 */
export function snapSegment(from: Vec, to: Vec, constrain?: boolean): Vec {
  if (!constrain) return to;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return to;
  const degrees = snapDegrees(Math.atan2(dy, dx) * 180 / Math.PI, 15);
  const radians = degrees * Math.PI / 180;
  return [from[0] + Math.cos(radians) * length, from[1] + Math.sin(radians) * length];
}

/**
 * 진행 방향의 수평에서 잰 앙각. 격자 90° 는 곡선이 닿지 않으므로 75° 로 접는다.
 * @returns 도. 시작과 같은 점이면 undefined
 */
export function launchAngle(from: Vec, to: Vec, constrain?: boolean): number | undefined {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (dx === 0 && dy === 0) return undefined;
  const travel = Math.abs(dx) < 1e-9 ? 0 : Math.sign(dx) * dx;
  let angle = Math.atan2(dy, travel) * 180 / Math.PI;
  if (constrain) {
    angle = snapDegrees(angle, 15);
    if (Math.abs(angle) >= 89) angle = Math.sign(angle) * 75;
  } else if (Math.abs(angle) >= 89) angle = Math.sign(angle) * 88.9;
  return angle;
}

/**
 * draft 를 지우고 객체를 붙인다. init 이 거절하면 진행 중 작도를 유지한다.
 * @param state 현재 작도
 * @param object 완성 객체
 */
export function commitObject(state: MechanicsState, object: MechanicsObject): PlaceResult<MechanicsState> {
  const { draft: _draft, ...spec } = state.spec;
  try { return { state: initMechanics({ ...spec, objects: [...spec.objects, object] }), handles: [object.id] }; }
  catch { return { state }; }
}

/**
 * @param state 현재 작도
 * @param draft 다음 클릭까지 저장할 진행 상태
 * @returns init 이 거절하면 현재 상태
 */
export function withDraft(state: MechanicsState, draft: NonNullable<MechanicsState["spec"]["draft"]>): PlaceResult<MechanicsState> {
  try { return { state: initMechanics({ ...state.spec, draft }) }; }
  catch { return { state }; }
}

/** @param ref 연결점 @param delta 장면 이동량 @returns 부착을 보존한 새 참조. 입력은 바꾸지 않는다. */
export function moveRef(ref: PointRef, delta: Vec): PointRef {
  if (ref.mode === "free") return { ...ref, point: [ref.point[0] + delta[0], ref.point[1] + delta[1]] };
  return { ...ref, offset: [(ref.offset?.[0] ?? 0) + delta[0], (ref.offset?.[1] ?? 0) + delta[1]] };
}
