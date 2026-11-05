/**
 * 1클릭 곡선. graph 는 시드 식, path 는 클릭점 S자.
 * 호스트는 tool id 만 넘긴다.
 */
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeoDef, GeometrySpec } from "../schema.ts";
import { nextEdgeId } from "./ids.ts";
import { clickView } from "./resolve-point.ts";

/**
 * @returns 새 곡선 id 는 손잡이. 모르는 tool 이면 undefined
 */
export function placeCurve(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> | undefined {
  if (ctx.tool === "graph") {
    return addEdge(state, ["graph", "y = sin(x)"]);
  }
  if (ctx.tool === "path") {
    const [x, y] = clickView(ctx, state);
    const span = (ctx.view.xmax - ctx.view.xmin) * 0.2;
    const d = [
      "M",
      x,
      y,
      "C",
      x + span / 3,
      y + span / 2,
      x + (2 * span) / 3,
      y - span / 2,
      x + span,
      y,
    ].join(" ");
    return addEdge(state, ["path", d]);
  }
  return undefined;
}

function addEdge(
  state: GeometryState,
  def: GeoDef["def"],
): PlaceResult<GeometryState> {
  const id = nextEdgeId(state);
  const spec: GeometrySpec = {
    ...state.spec,
    objects: [...state.spec.objects, { id, def }],
    draft: undefined,
  };
  return { state: initGeometry(spec), handles: [id] };
}
