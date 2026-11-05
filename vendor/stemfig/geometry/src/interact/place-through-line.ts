/**
 * 점 지나 평행·수선. place-projection 과 같은 2클릭.
 * 1) 점 P 2) 선분·직선 → A,B. 같은 (P,A,B) 재사용.
 * 파생 직선 id 는 손잡이가 아니다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextEdgeId } from "./ids.ts";
import { clearDraft, liveAfter, resolvePoint } from "./resolve-point.ts";
import { snapGeometry } from "./snap.ts";

export type ThroughLineTool = "parallel-line" | "perpendicular-line";

const DEF: Record<ThroughLineTool, "parallel_line" | "perp_line"> = {
  "parallel-line": "parallel_line",
  "perpendicular-line": "perp_line",
};

/**
 * @param ctx 페이지 mm 클릭
 * @param tool draft.tool 과 같아야 이어진다
 * @returns 이번 클릭에서 만든 자유점만
 */
export function placeThroughLine(
  ctx: PlaceCtx,
  state: GeometryState,
  tool: ThroughLineTool,
): PlaceResult<GeometryState> {
  const from = throughFrom(state.spec.draft, tool);
  if (!from || !state.byId.has(from)) {
    const at = resolvePoint(ctx, state);
    const { spec } = liveAfter(state, at);
    return {
      state: initGeometry({
        ...spec,
        draft: { tool, from: at.id },
      }),
      handles: at.created ? [at.id] : [],
    };
  }
  const ends = endsFromPathSnap(ctx, state);
  if (!ends) {
    return { state, handles: [] };
  }
  return finishThrough(state.spec, state, tool, from, ends[0], ends[1], []);
}

function throughFrom(
  draft: GeometrySpec["draft"],
  tool: ThroughLineTool,
): string | undefined {
  if (!draft || draft.tool !== tool) {
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

function finishThrough(
  spec: GeometrySpec,
  live: GeometryState,
  tool: ThroughLineTool,
  p: string,
  a: string,
  b: string,
  handles: string[],
): PlaceResult<GeometryState> {
  const head = DEF[tool];
  if (findThrough(spec, head, p, a, b)) {
    return { state: initGeometry(clearDraft(spec)), handles };
  }
  const id = nextEdgeId(live);
  return {
    state: initGeometry(withThrough(clearDraft(spec), id, head, p, a, b)),
    handles,
  };
}

function findThrough(
  spec: GeometrySpec,
  head: "parallel_line" | "perp_line",
  p: string,
  a: string,
  b: string,
): string | undefined {
  for (const obj of spec.objects) {
    if (obj.def[0] !== head) {
      continue;
    }
    const [, q, r, s] = obj.def;
    if (q === p && r === a && s === b) {
      return obj.id;
    }
  }
  return undefined;
}

function withThrough(
  spec: GeometrySpec,
  id: string,
  head: "parallel_line" | "perp_line",
  p: string,
  a: string,
  b: string,
): GeometrySpec {
  return {
    ...spec,
    objects: [...spec.objects, { id, def: [head, p, a, b] }],
  };
}
