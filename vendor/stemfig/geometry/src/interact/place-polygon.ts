/**
 * 다각형 N클릭. 첫 점 재클릭으로만 닫는다. PlaceCtx 에 키가 없다.
 * 연속 같은 점은 무시. 순환·역순이 같으면 재사용. 다각형 id 는 손잡이가 아니다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextEdgeId } from "./ids.ts";
import { clearDraft, liveAfter, resolvePoint } from "./resolve-point.ts";

/**
 * @param ctx 페이지 mm 클릭
 * @returns 꼭짓점 손잡이만. 다각형 id 는 빼다
 */
export function placePolygon(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> {
  const at = resolvePoint(ctx, state);
  const { spec, live } = liveAfter(state, at);
  const handles = at.created ? [at.id] : [];
  const verts = polygonVerts(spec.draft);
  if (!verts) {
    return {
      state: initGeometry({
        ...spec,
        draft: { tool: "polygon", vertices: [at.id] },
      }),
      handles,
    };
  }
  if (verts[verts.length - 1] === at.id) {
    return { state: live, handles };
  }
  if (at.id === verts[0]) {
    if (verts.length >= 3) {
      return closePolygon(spec, live, verts, handles);
    }
    return { state: live, handles };
  }
  return {
    state: initGeometry({
      ...spec,
      draft: { tool: "polygon", vertices: [...verts, at.id] },
    }),
    handles,
  };
}

function polygonVerts(draft: GeometrySpec["draft"]): string[] | undefined {
  if (!draft || draft.tool !== "polygon") {
    return undefined;
  }
  return draft.vertices;
}

function closePolygon(
  spec: GeometrySpec,
  live: GeometryState,
  verts: string[],
  handles: string[],
): PlaceResult<GeometryState> {
  const existing = findPolygon(spec, verts);
  if (existing) {
    return { state: initGeometry(clearDraft(spec)), handles };
  }
  const id = nextEdgeId(live);
  return {
    state: initGeometry(withPolygon(clearDraft(spec), id, verts)),
    handles,
  };
}

/**
 * 같은 꼭짓점 순환이면 같다. 시작점 회전과 역순을 본다.
 */
function sameCycle(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const n = a.length;
  for (let start = 0; start < n; start += 1) {
    let fwd = true;
    let rev = true;
    for (let i = 0; i < n; i += 1) {
      if (a[i] !== b[(start + i) % n]) {
        fwd = false;
      }
      if (a[i] !== b[(start - i + n) % n]) {
        rev = false;
      }
    }
    if (fwd || rev) {
      return true;
    }
  }
  return false;
}

function findPolygon(spec: GeometrySpec, verts: string[]): string | undefined {
  for (const obj of spec.objects) {
    if (obj.def[0] !== "polygon") {
      continue;
    }
    if (sameCycle(verts, obj.def.slice(1))) {
      return obj.id;
    }
  }
  return undefined;
}

function withPolygon(
  spec: GeometrySpec,
  id: string,
  verts: string[],
): GeometrySpec {
  return {
    ...spec,
    objects: [...spec.objects, { id, def: ["polygon", ...verts] }],
  };
}
