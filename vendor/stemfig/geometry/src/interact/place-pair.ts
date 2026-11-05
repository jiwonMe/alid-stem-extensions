/**
 * 2클릭 선분·직선·원.
 * 같은 점이면 draft 유지. 이미 있으면 새로 만들지 않는다.
 * 선분·직선은 양끝 순서 무시. 원은 중심→원주라 순서를 지킨다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextEdgeId } from "./ids.ts";
import { clearDraft, liveAfter, resolvePoint } from "./resolve-point.ts";

export type PairTool = "segment" | "circle" | "line";

/**
 * 1클릭: 점 + draft.from. 2클릭: 둘째 점을 고르고 객체를 붙인다.
 * @param ctx 페이지 mm 클릭
 * @param state 클릭 전
 * @param tool draft.tool 과 같아야 이어진다
 */
export function placePair(
  ctx: PlaceCtx,
  state: GeometryState,
  tool: PairTool,
): PlaceResult<GeometryState> {
  const at = resolvePoint(ctx, state);
  const { spec, live } = liveAfter(state, at);
  const from = pairFrom(spec.draft, tool);
  if (!from || !live.byId.has(from)) {
    return {
      state: initGeometry({ ...spec, draft: { tool, from: at.id } }),
      handles: [at.id],
    };
  }
  if (from === at.id) {
    return { state: live, handles: [at.id] };
  }
  const existing = findPair(spec, tool, from, at.id);
  if (existing) {
    return {
      state: initGeometry(clearDraft(spec)),
      handles: [existing],
    };
  }
  const edge = nextEdgeId(live);
  return {
    state: initGeometry(appendPair(clearDraft(spec), tool, edge, from, at.id)),
    handles: [edge, at.id],
  };
}

function pairFrom(
  draft: GeometrySpec["draft"],
  tool: PairTool,
): string | undefined {
  if (!draft || draft.tool !== tool) {
    return undefined;
  }
  return draft.from;
}

function findPair(
  spec: GeometrySpec,
  tool: PairTool,
  a: string,
  b: string,
): string | undefined {
  for (const obj of spec.objects) {
    if (obj.def[0] !== tool) {
      continue;
    }
    const [, p, q] = obj.def;
    if (tool === "circle") {
      if (p === a && q === b) {
        return obj.id;
      }
      continue;
    }
    if ((p === a && q === b) || (p === b && q === a)) {
      return obj.id;
    }
  }
  return undefined;
}

function appendPair(
  spec: GeometrySpec,
  tool: PairTool,
  id: string,
  a: string,
  b: string,
): GeometrySpec {
  const def =
    tool === "segment"
      ? (["segment", a, b] as const)
      : tool === "line"
        ? (["line", a, b] as const)
        : (["circle", a, b] as const);
  return {
    ...spec,
    objects: [...spec.objects, { id, def: [...def] }],
  };
}
