/**
 * 세 점 외접·내접원. 점 3클릭.
 * 같은 세 점 집합은 재사용. 순서는 무시한다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextEdgeId } from "./ids.ts";
import { clearDraft, liveAfter, resolvePoint } from "./resolve-point.ts";

export type TriCircleTool = "circle-three-points" | "circle-incircle";

const DEF: Record<TriCircleTool, "circumcircle" | "incircle"> = {
  "circle-three-points": "circumcircle",
  "circle-incircle": "incircle",
};

/**
 * @param ctx 페이지 mm 클릭
 * @param tool draft.tool 과 같아야 이어진다
 * @returns 새 점 손잡이만. 원 id 는 손잡이가 아니다
 */
export function placeTriCircle(
  ctx: PlaceCtx,
  state: GeometryState,
  tool: TriCircleTool,
): PlaceResult<GeometryState> {
  const at = resolvePoint(ctx, state);
  const { spec, live } = liveAfter(state, at);
  const handles = at.created ? [at.id] : [];
  const verts = triVerts(spec.draft, tool);
  if (!verts) {
    return {
      state: initGeometry({
        ...spec,
        draft: { tool, vertices: [at.id] },
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
        draft: { tool, vertices: [verts[0]!, at.id] },
      }),
      handles,
    };
  }
  return finishTri(spec, live, tool, verts[0]!, verts[1]!, at.id, handles);
}

function triVerts(
  draft: GeometrySpec["draft"],
  tool: TriCircleTool,
): string[] | undefined {
  if (!draft || draft.tool !== tool) {
    return undefined;
  }
  return [...draft.vertices];
}

function finishTri(
  spec: GeometrySpec,
  live: GeometryState,
  tool: TriCircleTool,
  a: string,
  b: string,
  c: string,
  handles: string[],
): PlaceResult<GeometryState> {
  const head = DEF[tool];
  if (findTri(spec, head, a, b, c)) {
    return { state: initGeometry(clearDraft(spec)), handles };
  }
  const id = nextEdgeId(live);
  return {
    state: initGeometry(withTri(clearDraft(spec), id, head, a, b, c)),
    handles,
  };
}

function findTri(
  spec: GeometrySpec,
  head: "circumcircle" | "incircle",
  a: string,
  b: string,
  c: string,
): string | undefined {
  const want = new Set([a, b, c]);
  for (const obj of spec.objects) {
    if (obj.def[0] !== head) {
      continue;
    }
    const have = new Set([obj.def[1], obj.def[2], obj.def[3]]);
    if (have.size === want.size && [...want].every((id) => have.has(id))) {
      return obj.id;
    }
  }
  return undefined;
}

function withTri(
  spec: GeometrySpec,
  id: string,
  head: "circumcircle" | "incircle",
  a: string,
  b: string,
  c: string,
): GeometrySpec {
  return {
    ...spec,
    objects: [...spec.objects, { id, def: [head, a, b, c] }],
  };
}
