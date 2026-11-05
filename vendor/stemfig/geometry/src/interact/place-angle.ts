/**
 * 각 주석. 점 3클릭 A → V → B.
 * 같은 V + {A,B} 만 재사용. 마크 id 는 손잡이가 아니다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextAnnotId } from "./ids.ts";
import { clearDraft, liveAfter, resolvePoint } from "./resolve-point.ts";

/**
 * @param ctx 페이지 mm 클릭
 * @returns 새 점 손잡이만
 */
export function placeAngle(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> {
  const at = resolvePoint(ctx, state);
  const { spec, live } = liveAfter(state, at);
  const handles = at.created ? [at.id] : [];
  const verts = angleVerts(spec.draft);
  if (!verts) {
    return {
      state: initGeometry({
        ...spec,
        draft: { tool: "angle-annotation", vertices: [at.id] },
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
        draft: { tool: "angle-annotation", vertices: [verts[0]!, at.id] },
      }),
      handles,
    };
  }
  return finishAngle(spec, live, verts[0]!, verts[1]!, at.id, handles);
}

function angleVerts(draft: GeometrySpec["draft"]): string[] | undefined {
  if (!draft || draft.tool !== "angle-annotation") {
    return undefined;
  }
  return [...draft.vertices];
}

function finishAngle(
  spec: GeometrySpec,
  live: GeometryState,
  a: string,
  v: string,
  b: string,
  handles: string[],
): PlaceResult<GeometryState> {
  if (findAngle(spec, a, v, b)) {
    return { state: initGeometry(clearDraft(spec)), handles };
  }
  const id = nextAnnotId(live);
  return {
    state: initGeometry(withAngle(clearDraft(spec), id, a, v, b)),
    handles,
  };
}

function findAngle(
  spec: GeometrySpec,
  a: string,
  v: string,
  b: string,
): string | undefined {
  for (const ang of spec.angles ?? []) {
    if (ang.v !== v) {
      continue;
    }
    if (
      (ang.a === a && ang.b === b) ||
      (ang.a === b && ang.b === a)
    ) {
      return ang.id;
    }
  }
  return undefined;
}

function withAngle(
  spec: GeometrySpec,
  id: string,
  a: string,
  v: string,
  b: string,
): GeometrySpec {
  return {
    ...spec,
    angles: [
      ...(spec.angles ?? []),
      { id, a, v, b, mark: "equal", ticks: 1 },
    ],
  };
}
