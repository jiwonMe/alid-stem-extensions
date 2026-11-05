/**
 * 역학 도구의 클릭 상태 기계. 미완성 점들은 spec.draft에만 기록한다.
 * 앱은 클릭과 도구 id만 넘기며 경로 완성·물체 부착·주석 연결은 이 모듈의 책임이다.
 */
import { toPage } from "@stemfig/display";
import type { ApplyCtx, PlaceCtx, PlaceResult } from "@stemfig/host";
import { snapRadiusMm } from "@stemfig/plugin-kit";
import { initMechanics, referencePoint, type MechanicsState } from "../init.ts";
import type { MechanicsSpec, Vec } from "../schema.ts";
import { guidanceMechanics } from "./guidance.ts";
import { placeMotion } from "./place-motion.ts";
import { pulleyAt, shortestWrap } from "./rope-routing.ts";
import { commitObject, nextId, referenceAt, scenePoint, snapSegment, trackAt, withDraft } from "./shared.ts";

/**
 * @param ctx 플러그인 도구와 페이지 클릭 @param state 현재 작도
 * @returns 다음 작도와 새 선택 id. 모르는 도구는 undefined, 같은 점 클릭은 현재 상태.
 */
export function placeMechanics(ctx: PlaceCtx, state: MechanicsState): PlaceResult<MechanicsState> | undefined {
  const motion = placeMotion(ctx, state);
  if (motion) return motion;
  const point = scenePoint(ctx);
  if (!point.every(Number.isFinite)) return { state };
  const id = nextId(state, ctx.tool);
  if (ctx.tool === "block") {
    const track = trackAt(ctx, state);
    /* 새 물체는 장면 폭의 1/16이다. 인쇄 선폭과 달리 view 크기를 따른다. */
    const width = (ctx.view.xmax - ctx.view.xmin) / 16;
    return commitObject(state, { id, type: "block", width, height: width * 0.7,
      label: "A", pose: track ? { mode: "track", track: track.id, t: track.t, offset: 0 }
        : { mode: "free", point, angle: 0 } });
  }
  if (ctx.tool === "label") return commitObject(state, { id, type: "label", label: "표시", at: referenceAt(ctx, state) });
  if (ctx.tool === "support") {
    /* 받침대 폭은 물체와 같은 장면 폭의 1/16, 높이는 폭의 3/4로 시작한다. */
    const width = (ctx.view.xmax - ctx.view.xmin) / 16;
    return commitObject(state, { id, type: "support", point, width, height: width * 0.75, angle: 0 });
  }
  if (!["track", "force", "dimension", "guide", "spring", "rope", "pulley"].includes(ctx.tool)) return undefined;
  const tool = ctx.tool as NonNullable<MechanicsSpec["draft"]>["tool"];
  const draft = state.spec.draft?.tool === tool ? state.spec.draft : undefined;
  if (!draft) {
    /* 도르래 중심은 자유 좌표다. 근처 블록에 임의로 종속시키지 않는다. */
    const from = tool === "pulley" ? undefined : referenceAt(ctx, state);
    return withDraft(state, { tool, points: [point], from });
  }
  const first = draft.points[0]!;
  const previous = draft.points[draft.points.length - 1]!;
  const page = toPage(ctx.view, ctx.frame)(...previous);
  const nearLast = Math.hypot(page[0] - ctx.x_mm, page[1] - ctx.y_mm) <= snapRadiusMm(ctx.px_per_mm);
  if (tool === "track") {
    if (nearLast) {
      if (draft.points.length < 2) return { state };
      return commitObject(state, { id, type: "track", points: draft.points, rounding: 0 });
    }
    const previousPoint = draft.points[draft.points.length - 1]!;
    return withDraft(state, { ...draft, points: [...draft.points, snapSegment(previousPoint, point, ctx.constrain)] });
  }
  if (tool === "pulley") {
    const radius = Math.hypot(point[0] - first[0], point[1] - first[1]);
    if (!(radius > 0) || !Number.isFinite(radius)) return { state };
    return commitObject(state, { id, type: "pulley", center: first, radius });
  }
  const from = draft.from ?? { mode: "free" as const, point: first };
  const start = referencePoint(from, state);
  if (Math.hypot(point[0] - start[0], point[1] - start[1]) === 0) return { state };
  const aimed = tool === "force" ? snapSegment(start, point, ctx.constrain) : point;
  const delta: Vec = [aimed[0] - start[0], aimed[1] - start[1]];
  if (tool === "force") return commitObject(state, { id, type: "force", from, delta, label: "$F$" });
  if (tool === "rope" && !draft.pulley) {
    const pulley = pulleyAt(ctx, state);
    if (pulley) {
      /* 첫 끝점이 바퀴 안이면 아직 경유를 선택할 수 없다. 기존 draft를 유지한다. */
      if (Math.hypot(start[0] - pulley.center[0], start[1] - pulley.center[1]) < pulley.radius) return { state };
      return withDraft(state, { ...draft, pulley: pulley.id });
    }
  }
  const b = referenceAt(ctx, state, tool === "rope" ? draft.pulley : undefined);
  const end = referencePoint(b, state);
  if (Math.hypot(end[0] - start[0], end[1] - start[1]) === 0) return { state };
  if (tool === "spring") {
    /* 감긴 수 8은 새 교재 작도의 기본값이며 길이를 바꿔도 유지한다. */
    const width = (ctx.view.xmax - ctx.view.xmin) / 32;
    return commitObject(state, { id, type: "spring", a: from, b, width, coils: 8 });
  }
  if (tool === "rope") {
    const pulley = draft.pulley ? state.byId.get(draft.pulley) : undefined;
    if (draft.pulley && pulley?.type !== "pulley") return { state };
    const wrap = pulley?.type === "pulley" ? shortestWrap(start, end, pulley) : "cw";
    return wrap ? commitObject(state, { id, type: "rope", a: from, b, wrap, ...(pulley ? { pulley: pulley.id } : {}) }) : { state };
  }
  if (tool === "guide") return commitObject(state, { id, type: "guide", a: from, b, dashed: true });
  const axis = Math.abs(delta[1]) >= Math.abs(delta[0]) ? "vertical" : "horizontal";
  return commitObject(state, { id, type: "dimension", a: from, b, axis, offset: 0, label: "$h$" });
}

/**
 * @param ctx 현재 도구와 봉투 @param state 진행 중인 작도
 * @returns 점이 두 개 이상인 경로를 완성한다. 아직 끝낼 수 없거나 다른 도구이면 undefined다.
 */
export function finishMechanics(ctx: ApplyCtx & { tool: string }, state: MechanicsState): PlaceResult<MechanicsState> | undefined {
  const draft = state.spec.draft;
  if ((ctx.tool !== "track" && ctx.tool !== "ground") || draft?.tool !== ctx.tool || draft.points.length < 2) return undefined;
  if (ctx.tool === "ground") {
    return commitObject(state, { id: nextId(state, "ground"), type: "track", points: draft.points, rounding: 0,
      ground: { style: "shade", side: "below", depth: 3 }, label: "지면" });
  }
  return commitObject(state, { id: nextId(state, "track"), type: "track", points: draft.points, rounding: 0 });
}

/** @param _ctx 호스트 봉투 @param state 현재 작도 @returns 완성 객체를 보존하고 draft만 지운 상태. */
export function cancelMechanics(_ctx: ApplyCtx, state: MechanicsState): MechanicsState {
  if (!state.spec.draft) return state;
  const { draft: _draft, ...spec } = state.spec;
  return initMechanics(spec);
}

export { guidanceMechanics };
