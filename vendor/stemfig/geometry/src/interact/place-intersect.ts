/**
 * 교점. 경로 두 번. 같은 (pathA, pathB, index) 만 재사용.
 * feature 스냅이어도 쌍은 여기서 다시 계산한다. 파생점 id 는 손잡이가 아니다.
 */
import { fitView } from "@stemfig/display";
import type { PlaceCtx, PlaceResult } from "@stemfig/host";
import { pageToLocal } from "@stemfig/plugin-kit";
import { initGeometry, type GeometryState } from "../init.ts";
import {
  listIntersections,
  nearestIntersection,
  pathGeomOf,
  type PathGeom,
} from "../intersect.ts";
import type { GeometrySpec } from "../schema.ts";
import { nextPointId } from "./ids.ts";
import { clearDraft } from "./resolve-point.ts";
import { snapGeometry } from "./snap.ts";

/**
 * @param ctx 페이지 mm 클릭
 * @returns 교점 id 는 handles 에서 빼다
 */
export function placeIntersect(
  ctx: PlaceCtx,
  state: GeometryState,
): PlaceResult<GeometryState> {
  const from = intersectionFrom(state.spec.draft);
  if (!from || !state.byId.has(from)) {
    const near = nearIntersect(ctx, state);
    if (near) {
      return finishIntersect(state.spec, state, near.a, near.b, near.index);
    }
    const path = pathFromClick(ctx, state);
    if (!path) {
      return { state, handles: [] };
    }
    return {
      state: initGeometry({
        ...state.spec,
        draft: { tool: "intersection", path },
      }),
      handles: [],
    };
  }
  const pick = pickSecond(ctx, state, from);
  if (!pick) {
    return { state, handles: [] };
  }
  return finishIntersect(state.spec, state, pick.a, pick.b, pick.index);
}

function intersectionFrom(draft: GeometrySpec["draft"]): string | undefined {
  if (!draft || draft.tool !== "intersection") {
    return undefined;
  }
  return draft.path;
}

function nearIntersect(
  ctx: PlaceCtx,
  state: GeometryState,
): { a: string; b: string; index: number } | undefined {
  const [x, y] = clickView(ctx, state);
  const near = nearestIntersection(state.spec.objects, state.points, x, y);
  if (!near) {
    return undefined;
  }
  const snap = snapGeometry(ctx, state);
  if (snap?.kind === "feature") {
    return { a: near.a, b: near.b, index: near.index };
  }
  return undefined;
}

function pathFromClick(ctx: PlaceCtx, state: GeometryState): string | undefined {
  const snap = snapGeometry(ctx, state);
  if (snap?.kind === "path") {
    const obj = state.byId.get(snap.id);
    if (obj && pathGeomOf(obj, state.points)) {
      return snap.id;
    }
  }
  const [x, y] = clickView(ctx, state);
  return nearestIntersection(state.spec.objects, state.points, x, y)?.a;
}

function pickSecond(
  ctx: PlaceCtx,
  state: GeometryState,
  from: string,
): { a: string; b: string; index: number } | undefined {
  const snap = snapGeometry(ctx, state);
  const [x, y] = clickView(ctx, state);
  if (snap?.kind === "path" && snap.id !== from) {
    const ga = geomOf(state, from);
    const gb = geomOf(state, snap.id);
    if (!ga || !gb) {
      return undefined;
    }
    const hits = listIntersections(ga, gb);
    if (!hits || hits.length === 0) {
      return undefined;
    }
    let index = 0;
    let best = Infinity;
    hits.forEach((hit, i) => {
      const d = Math.hypot(hit.x - x, hit.y - y);
      if (d < best) {
        best = d;
        index = i;
      }
    });
    return { a: from, b: snap.id, index };
  }
  const near = nearestIntersection(state.spec.objects, state.points, x, y);
  if (!near || (near.a !== from && near.b !== from)) {
    return undefined;
  }
  if (near.a === from) {
    return { a: from, b: near.b, index: near.index };
  }
  return undefined;
}

function geomOf(state: GeometryState, id: string): PathGeom | undefined {
  const obj = state.byId.get(id);
  return obj ? pathGeomOf(obj, state.points) : undefined;
}

function finishIntersect(
  spec: GeometrySpec,
  live: GeometryState,
  a: string,
  b: string,
  index: number,
): PlaceResult<GeometryState> {
  if (findIntersect(spec, a, b, index)) {
    return { state: initGeometry(clearDraft(spec)), handles: [] };
  }
  const id = nextPointId(live);
  return {
    state: initGeometry(withIntersect(clearDraft(spec), id, a, b, index)),
    handles: [],
  };
}

function findIntersect(
  spec: GeometrySpec,
  a: string,
  b: string,
  index: number,
): string | undefined {
  for (const obj of spec.objects) {
    if (obj.def[0] !== "intersect") {
      continue;
    }
    const [, p, q, i] = obj.def;
    if (p === a && q === b && i === index) {
      return obj.id;
    }
  }
  return undefined;
}

function withIntersect(
  spec: GeometrySpec,
  id: string,
  a: string,
  b: string,
  index: number,
): GeometrySpec {
  return {
    ...spec,
    objects: [...spec.objects, { id, def: ["intersect", a, b, index], label: id }],
  };
}

function clickView(ctx: PlaceCtx, _state: GeometryState): [number, number] {
  const [lx, ly] = pageToLocal(ctx.frame, ctx.x_mm, ctx.y_mm);
  return fitView(ctx.view, ctx.frame).fromLocal(lx, ly);
}
