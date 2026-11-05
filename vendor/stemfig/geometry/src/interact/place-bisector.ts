/**
 * 각 이등분선. 점 3클릭 A → V → B.
 * 기본 internal. (A,V,B) 순서만 재사용. 뒤집지 않는다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextEdgeId } from "./ids.ts";
import { clearDraft, liveAfter, resolvePoint } from "./resolve-point.ts";

/**
 * @param ctx 페이지 mm 클릭
 * @returns 새 점 손잡이만. 이등분선 id 는 손잡이가 아니다
 */
export function placeBisector(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> {
  const at = resolvePoint(ctx, state);
  const { spec, live } = liveAfter(state, at);
  const handles = at.created ? [at.id] : [];
  const verts = bisectorVerts(spec.draft);
  if (!verts) {
    return {
      state: initGeometry({
        ...spec,
        draft: { tool: "angle-bisector", vertices: [at.id] },
      }),
      handles,
    };
  }
  if (verts[verts.length - 1] === at.id) {
    return { state: live, handles };
  }
  if (verts.length === 1) {
    return {
      state: initGeometry({
        ...spec,
        draft: { tool: "angle-bisector", vertices: [verts[0]!, at.id] },
      }),
      handles,
    };
  }
  return finishBisector(spec, live, verts[0]!, verts[1]!, at.id, handles);
}

function bisectorVerts(draft: GeometrySpec["draft"]): string[] | undefined {
  if (!draft || draft.tool !== "angle-bisector") {
    return undefined;
  }
  return [...draft.vertices];
}

function finishBisector(
  spec: GeometrySpec,
  live: GeometryState,
  a: string,
  v: string,
  b: string,
  handles: string[],
): PlaceResult<GeometryState> {
  if (findBisector(spec, a, v, b)) {
    return { state: initGeometry(clearDraft(spec)), handles };
  }
  const id = nextEdgeId(live);
  return {
    state: initGeometry(withBisector(clearDraft(spec), id, a, v, b)),
    handles,
  };
}

function findBisector(
  spec: GeometrySpec,
  a: string,
  v: string,
  b: string,
): string | undefined {
  for (const obj of spec.objects) {
    if (obj.def[0] !== "bisector") {
      continue;
    }
    if (obj.def[1] === a && obj.def[2] === v && obj.def[3] === b) {
      return obj.id;
    }
  }
  return undefined;
}

function withBisector(
  spec: GeometrySpec,
  id: string,
  a: string,
  v: string,
  b: string,
): GeometrySpec {
  return {
    ...spec,
    objects: [
      ...spec.objects,
      { id, def: ["bisector", a, v, b, "internal"] },
    ],
  };
}
