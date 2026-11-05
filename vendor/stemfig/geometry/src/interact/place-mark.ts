/**
 * 변 틱. 양 끝점 2클릭. segment 객체는 없어도 된다.
 * 같은 {A,B} 만 재사용. 마크 id 는 손잡이가 아니다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextAnnotId } from "./ids.ts";
import { clearDraft } from "./resolve-point.ts";
import { snapGeometry } from "./snap.ts";

/**
 * 1클릭: draft.from. 2클릭: 두 점 사이 틱. 선분은 찾지 않는다.
 * @param ctx 페이지 mm 클릭
 * @returns handles 없음
 */
export function placeMark(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> {
  const at = endpointFromClick(ctx, state);
  if (!at) {
    return { state, handles: [] };
  }
  const from = markFrom(state.spec.draft);
  if (!from) {
    return {
      state: initGeometry({
        ...state.spec,
        draft: { tool: "segment-annotation", from: at },
      }),
      handles: [],
    };
  }
  if (from === at) {
    return { state, handles: [] };
  }
  if (findMark(state.spec, from, at)) {
    return { state: initGeometry(clearDraft(state.spec)), handles: [] };
  }
  const id = nextAnnotId(state);
  return {
    state: initGeometry(withMark(clearDraft(state.spec), id, from, at)),
    handles: [],
  };
}

/**
 * 이미 있는 점만. 빈 곳·경로 위는 끝점이 아니다.
 */
function endpointFromClick(
  ctx: PlaceCtx,
  state: GeometryState,
): string | undefined {
  const snap = snapGeometry(ctx, state);
  if (snap?.kind !== "point") {
    return undefined;
  }
  return snap.id;
}

function markFrom(draft: GeometrySpec["draft"]): string | undefined {
  if (!draft || draft.tool !== "segment-annotation") {
    return undefined;
  }
  return draft.from;
}

function findMark(
  spec: GeometrySpec,
  a: string,
  b: string,
): string | undefined {
  return spec.marks?.find((item) => sameEnds(item.a, item.b, a, b))?.id;
}

function sameEnds(p: string, q: string, a: string, b: string): boolean {
  return (p === a && q === b) || (p === b && q === a);
}

function withMark(
  spec: GeometrySpec,
  id: string,
  a: string,
  b: string,
): GeometrySpec {
  return {
    ...spec,
    marks: [...(spec.marks ?? []), { id, a, b, ticks: 1 }],
  };
}
