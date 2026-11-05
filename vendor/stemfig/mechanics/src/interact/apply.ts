/**
 * 드래그는 원본 파라미터만 바꾼 뒤 init으로 다시 푼다.
 * 끝점 노브는 포인터 위치로 재연결하며 본체 이동·키보드 이동은 기존 연결을 보존한다.
 * 실패한 편집은 현재 상태를 보존하고 undo는 앱의 HistoryStore가 맡는다.
 */
import { fitView } from "@stemfig/display";
import type { ApplyCtx, HandlePatch, RemoveResult } from "@stemfig/host";
import { nearestOnTrack } from "../geometry.ts";
import { initMechanics, type MechanicsState } from "../init.ts";
import { mechanicsSpecSchema, type MechanicsObject, type PointRef, type Vec } from "../schema.ts";
import { applyMotion } from "./apply-motion.ts";
import { dependencyIds, moveRef, ownerId, referenceAt } from "./shared.ts";

/**
 * @param ctx 봉투 좌표계 @param state 현재 작도 @param patch 페이지 mm 이동
 * @returns 새 상태. 알 수 없는 손잡이나 퇴화한 결과는 입력 상태를 반환한다.
 */
export function applyMechanics(ctx: ApplyCtx, state: MechanicsState, patch: HandlePatch): MechanicsState {
  if (![patch.dx_mm, patch.dy_mm].every(Number.isFinite)) return state;
  if (patch.dx_mm === 0 && patch.dy_mm === 0 && !patch.pointer) return state;
  if (patch.pointer && ![patch.pointer.x_mm, patch.pointer.y_mm].every(Number.isFinite)) return state;
  const obj = state.byId.get(ownerId(patch.id));
  if (!obj) return state;
  const scale = fitView(ctx.view, ctx.frame);
  /* 수학 y-up과 페이지 y-down 사이에서 델타 부호를 한 번만 뒤집는다. */
  const delta: Vec = [patch.dx_mm / scale.scaleX, -patch.dy_mm / scale.scaleY];
  if (!delta.every(Number.isFinite)) return state;
  const suffix = patch.id.slice(obj.id.length + 1);
  /* 점 노브만 새 연결 의도를 갖는다. 본체 이동·키보드 nudging은 기존 참조의 offset을 옮긴다. */
  const endpoint = (ref: PointRef) => patch.pointer
    ? referenceAt({ ...ctx, ...patch.pointer, tool: "connect" }, state, obj.id)
    : moveRef(ref, delta);
  let next: MechanicsObject = obj;
  const motion = applyMotion(ctx, state, obj, suffix, delta, patch);
  if (motion) next = motion;
  else if (suffix === "label" || (obj.type === "label" && !suffix)) {
    next = { ...obj, labelOffset: [(obj.labelOffset?.[0] ?? 0) + patch.dx_mm, (obj.labelOffset?.[1] ?? 0) + patch.dy_mm] };
  } else if (obj.type === "track") {
    const index = suffix.startsWith("point:") ? Number(suffix.slice(6)) : undefined;
    if (suffix && (index === undefined || !Number.isInteger(index) || String(index) !== suffix.slice(6) || !obj.points[index])) return state;
    next = { ...obj, points: obj.points.map((p, i): Vec => index === undefined || index === i ? add(p, delta) : p) };
  } else if (obj.type === "block") {
    if (suffix) return state;
    if (obj.pose.mode === "free") next = { ...obj, pose: { ...obj.pose, point: add(obj.pose.point, delta) } };
    else {
      const pose = state.poses.get(obj.id)!;
      const points = state.tracks.get(obj.pose.track)!;
      const t = nearestOnTrack(points, add(pose.point, delta)).t;
      next = { ...obj, pose: { ...obj.pose, t } };
    }
  } else if (obj.type === "pulley") {
    if (!suffix || suffix === "center") next = { ...obj, center: add(obj.center, delta) };
    /* 반지름 손잡이는 오른쪽 원주에 놓인다. 페이지 델타는 이미 장면으로 변환했다. */
    else if (suffix === "radius") next = { ...obj, radius: Math.hypot(obj.radius + delta[0], delta[1]) };
    else return state;
  } else if (obj.type === "support") {
    if (!suffix || suffix === "point") next = { ...obj, point: add(obj.point, delta) };
    else return state;
  } else if (obj.type === "force") {
    if (suffix === "end") next = { ...obj, delta: add(obj.delta, delta) };
    else if (suffix === "from") next = { ...obj, from: endpoint(obj.from) };
    else if (!suffix) next = { ...obj, from: moveRef(obj.from, delta) };
    else return state;
  } else if (obj.type === "dimension" || obj.type === "guide" || obj.type === "spring" || obj.type === "rope") {
    if (suffix === "a" || suffix === "b") next = { ...obj, [suffix]: endpoint(obj[suffix]) };
    else if (suffix) return state;
    else if (obj.type === "dimension") next = { ...obj, offset: obj.offset + delta[obj.axis === "vertical" ? 0 : 1] };
    else next = { ...obj, a: moveRef(obj.a, delta), b: moveRef(obj.b, delta) };
  } else if (obj.type === "label" && suffix === "at") next = { ...obj, at: endpoint(obj.at) };
  if (next === obj || JSON.stringify(next) === JSON.stringify(obj)) return state;
  try {
    const spec = mechanicsSpecSchema.safeParse({ ...state.spec, objects: state.spec.objects.map((item) => item.id === obj.id ? next : item) });
    return spec.success ? initMechanics(spec.data) : state;
  }
  catch { return state; }
}

function add(a: Vec, b: Vec): Vec { return [a[0] + b[0], a[1] + b[1]]; }

/**
 * 객체 삭제는 경로→물체→주석과 도르래를 감싼 실의 의존 관계를 함께 정리한다.
 * @param _ctx 봉투 @param state 현재 작도 @param ids 내부 선택 id
 * @returns 실제 삭제 id와 새 상태. 선택이 없으면 undefined. draft는 함께 취소한다.
 */
export function removeMechanics(_ctx: ApplyCtx, state: MechanicsState, ids: readonly string[]): RemoveResult<MechanicsState> | undefined {
  const removed = new Set(ids.map(ownerId).filter((id) => state.byId.has(id)));
  if (!removed.size) return undefined;
  let changed = true;
  while (changed) {
    changed = false;
    for (const obj of state.spec.objects) {
      if (removed.has(obj.id)) continue;
      if (dependencyIds(obj).some((id) => removed.has(id))) {
        removed.add(obj.id); changed = true;
      }
    }
  }
  const { draft: _draft, ...spec } = state.spec;
  return { state: initMechanics({ ...spec, objects: spec.objects.filter((obj) => !removed.has(obj.id)) }),
    removed: [...removed, ...ids] };
}
