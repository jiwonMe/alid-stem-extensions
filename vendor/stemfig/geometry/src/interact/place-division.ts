/**
 * 내분점. 선분·직선 경로면 양 끝으로 바로 만든다. on_path 를 만들지 않는다.
 * 아니면 2클릭. 같은 (A,B,1,1,internal) 만 재사용. A–B 뒤집기는 다른 비율이다.
 * 찍을 때는 항상 1:1 내분. 비율·내외분은 패널이 고친다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextPointId } from "./ids.ts";
import {
  clearDraft,
  liveAfter,
  resolvePoint,
} from "./resolve-point.ts";
import { snapGeometry } from "./snap.ts";

const PLACE_M = 1;
const PLACE_N = 1;
const PLACE_MODE = "internal" as const;

/**
 * @param ctx 페이지 mm 클릭
 * @returns 이번 클릭에서 만든 자유점만. 내분점 id 는 빼다
 */
export function placeDivision(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> {
  const ends = endsFromPathSnap(ctx, state);
  if (ends) {
    return finishDivision(state.spec, state, ends[0], ends[1], []);
  }
  const at = resolvePoint(ctx, state);
  const { spec, live } = liveAfter(state, at);
  const handles = at.created ? [at.id] : [];
  const from = divisionFrom(spec.draft);
  if (!from || !live.byId.has(from)) {
    return {
      state: initGeometry({ ...spec, draft: { tool: "division", from: at.id } }),
      handles,
    };
  }
  if (from === at.id) {
    return { state: live, handles };
  }
  return finishDivision(spec, live, from, at.id, handles);
}

function endsFromPathSnap(
  ctx: PlaceCtx,
  state: GeometryState,
): [string, string] | undefined {
  const snap = snapGeometry(ctx, state);
  if (snap?.kind !== "path") {
    return undefined;
  }
  const obj = state.byId.get(snap.id);
  if (!obj || (obj.def[0] !== "segment" && obj.def[0] !== "line")) {
    return undefined;
  }
  return [obj.def[1], obj.def[2]];
}

function divisionFrom(draft: GeometrySpec["draft"]): string | undefined {
  if (!draft || draft.tool !== "division") {
    return undefined;
  }
  return draft.from;
}

function finishDivision(
  spec: GeometrySpec,
  live: GeometryState,
  a: string,
  b: string,
  handles: string[],
): PlaceResult<GeometryState> {
  const existing = findDivision(spec, a, b);
  if (existing) {
    return { state: initGeometry(clearDraft(spec)), handles };
  }
  const id = nextPointId(live);
  return {
    state: initGeometry(withDivision(clearDraft(spec), id, a, b)),
    handles,
  };
}

/**
 * 같은 (A,B,1,1,internal) 만. A–B 뒤집기는 재사용하지 않는다.
 */
function findDivision(
  spec: GeometrySpec,
  a: string,
  b: string,
): string | undefined {
  for (const obj of spec.objects) {
    if (obj.def[0] !== "division") {
      continue;
    }
    const [, p, q, m, n, mode] = obj.def;
    if (
      p === a &&
      q === b &&
      m === PLACE_M &&
      n === PLACE_N &&
      mode === PLACE_MODE
    ) {
      return obj.id;
    }
  }
  return undefined;
}

function withDivision(
  spec: GeometrySpec,
  id: string,
  a: string,
  b: string,
): GeometrySpec {
  return {
    ...spec,
    objects: [
      ...spec.objects,
      { id, def: ["division", a, b, PLACE_M, PLACE_N, PLACE_MODE], label: id },
    ],
  };
}
