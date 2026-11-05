/**
 * 작도 삭제의 참조 경계. 호스트는 점·경로·각의 의존 관계를 모른다.
 * 삭제 대상에 의존하는 객체를 고정점까지 확장한 뒤 주석과 draft 를 정리한다.
 */
import type { ApplyCtx, RemoveResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { labelHandleId, parseLabelHandle } from "../label-handle.ts";
import { listControls, parsePathHandle, pathHandleId } from "../path-handle.ts";
import { parseD } from "../math/svg-path.ts";
import type { GeoDef } from "../schema.ts";

/**
 * 별칭을 소유 객체로 바꿔 객체 전체를 삭제한다. 남은 객체의 정의 순서는 보존한다.
 * @param ids 본체·라벨·경로 제어점 손잡이
 * @returns 실제로 삭제된 모든 객체 id. 없는 선택은 원래 상태
 */
export function removeGeometry(_ctx: ApplyCtx, state: GeometryState, ids: readonly string[]): RemoveResult<GeometryState> {
  const removed = new Set(ids.map((id) => parseLabelHandle(id) ?? parsePathHandle(id)?.id ?? id));
  const all = [...state.spec.objects, ...(state.spec.angles ?? []), ...(state.spec.marks ?? [])];
  for (const id of removed) if (!all.some((obj) => obj.id === id)) removed.delete(id);
  if (removed.size === 0) return { state, removed: [] };
  let changed = true;
  while (changed) {
    changed = false;
    for (const obj of state.spec.objects) {
      if (!removed.has(obj.id) && references(obj).some((id) => removed.has(id))) {
        removed.add(obj.id);
        changed = true;
      }
    }
  }
  for (const ang of state.spec.angles ?? []) {
    if ([ang.a, ang.v, ang.b].some((id) => removed.has(id))) removed.add(ang.id);
  }
  for (const mark of state.spec.marks ?? []) {
    if ([mark.a, mark.b].some((id) => removed.has(id))) removed.add(mark.id);
  }
  /* draft 는 결과물이 아니다. 삭제 뒤 이어 누르면 사라진 참조가 살아나지 않게 비운다. */
  const { draft: _draft, ...spec } = state.spec;
  return { state: initGeometry({
    ...spec,
    objects: spec.objects.filter((obj) => !removed.has(obj.id)),
    ...(spec.angles ? { angles: spec.angles.filter((obj) => !removed.has(obj.id)) } : {}),
    ...(spec.marks ? { marks: spec.marks.filter((obj) => !removed.has(obj.id)) } : {}),
  }), removed: [...removed].flatMap((id) => deletedAliases(state, id)) };
}

/** 본체를 지울 때 선택하지 않은 라벨·제어점 whitelist 도 호스트가 정리할 수 있게 보고한다. */
function deletedAliases(state: GeometryState, id: string): string[] {
  const aliases = [id, labelHandleId(id)];
  const obj = state.byId.get(id);
  if (obj?.def[0] === "path") {
    try {
      aliases.push(...listControls(parseD(obj.def[1], "d")).map((control) => pathHandleId(id, control.index)));
    } catch { /* 파싱되지 않는 기존 경로도 본체 삭제는 허용한다. */ }
  }
  return aliases;
}

/** 문자열 전체를 참조로 취급하면 수식·path 원문·mode 문자열을 잘못 삭제한다. */
function references(obj: GeoDef): string[] {
  const def = obj.def;
  switch (def[0]) {
    case "point": case "graph": case "path": return [];
    case "on_path": return [def[1]];
    case "segment": case "line": case "circle": case "division": case "intersect": return [def[1], def[2]];
    case "projection": case "parallel_line": case "perp_line": case "bisector": case "circumcircle": case "incircle": return [def[1], def[2], def[3]];
    case "polygon": return def.slice(1);
  }
}
