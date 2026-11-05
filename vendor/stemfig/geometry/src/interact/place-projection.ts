/**
 * 수선의 발. 점 P 다음 선분·직선. 항상 ["projection", P, A, B].
 * 같은 (P,A,B) 만 재사용. 파생점 id 는 손잡이가 아니다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextPointId } from "./ids.ts";
import { clearDraft, liveAfter, resolvePoint } from "./resolve-point.ts";
import { snapGeometry } from "./snap.ts";

/**
 * @param ctx 페이지 mm 클릭
 * @returns 이번 클릭에서 만든 자유점만
 */
export function placeProjection(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> {
  const from = projectionFrom(state.spec.draft);
  if (!from || !state.byId.has(from)) {
    const at = resolvePoint(ctx, state);
    const { spec } = liveAfter(state, at);
    const handles = at.created ? [at.id] : [];
    return {
      state: initGeometry({
        ...spec,
        draft: { tool: "perpendicular", from: at.id },
      }),
      handles,
    };
  }
  const ends = endsFromPathSnap(ctx, state);
  if (!ends) {
    return { state, handles: [] };
  }
  return finishProjection(state.spec, state, from, ends[0], ends[1], []);
}

function projectionFrom(draft: GeometrySpec["draft"]): string | undefined {
  if (!draft || draft.tool !== "perpendicular") {
    return undefined;
  }
  return draft.from;
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

function finishProjection(
  spec: GeometrySpec,
  live: GeometryState,
  p: string,
  a: string,
  b: string,
  handles: string[],
): PlaceResult<GeometryState> {
  if (findProjection(spec, p, a, b)) {
    return { state: initGeometry(clearDraft(spec)), handles };
  }
  const id = nextPointId(live);
  return {
    state: initGeometry(withProjection(clearDraft(spec), id, p, a, b)),
    handles,
  };
}

function findProjection(
  spec: GeometrySpec,
  p: string,
  a: string,
  b: string,
): string | undefined {
  for (const obj of spec.objects) {
    if (obj.def[0] !== "projection") {
      continue;
    }
    const [, q, r, s] = obj.def;
    if (q === p && r === a && s === b) {
      return obj.id;
    }
  }
  return undefined;
}

function withProjection(
  spec: GeometrySpec,
  id: string,
  p: string,
  a: string,
  b: string,
): GeometrySpec {
  return {
    ...spec,
    objects: [...spec.objects, { id, def: ["projection", p, a, b], label: id }],
  };
}
