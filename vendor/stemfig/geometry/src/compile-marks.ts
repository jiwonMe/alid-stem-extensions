/**
 * angles / marks → DisplayList. objects 가 아니다.
 * arc op 금지. 퇴화면 그 칸만 생략. SPEC 으로 점을 잠그지 않는다.
 */
import type { DisplayItem } from "@stemfig/display";
import { projectView } from "@stemfig/plugin-kit";
import type { CompileCtx } from "@stemfig/host";
import { paintItems, resolvePaint } from "./paint.ts";
import type { GeometryState, Point } from "./init.ts";
import {
  ANGLE_MARK_WIDTH_MM,
  angleLabelAt,
  equalArcs,
  equalCircles,
  equalDots,
  rightSquare,
  segmentCircles,
  segmentTicks,
  type HollowMark,
} from "./mark-geom.ts";
import {
  dashPoly,
  SEG_ARC_WIDTH_MM,
  segmentBow,
} from "./seg-label-arc.ts";
import { arcLabelBaselineAt, bowApex } from "./arc-label-pos.ts";
import { clipPolyOutside, labelClipRect } from "./seg-label-clip.ts";

/**
 * show 뒤에 붙인다. 호스트는 이 키를 모른다.
 */
export function compileMarks(
  ctx: CompileCtx,
  state: GeometryState,
): DisplayItem[] {
  const { toPage } = projectView(ctx, ctx.view);
  const items: DisplayItem[] = [];
  for (const ang of state.spec.angles ?? []) {
    items.push(...paintItems(drawAngle(ang, state, { ...ctx, style: resolvePaint(ctx.style, ang) }, toPage), ang));
  }
  for (const mark of state.spec.marks ?? []) {
    items.push(...paintItems(drawSegMark(mark, state, { ...ctx, style: resolvePaint(ctx.style, mark) }, toPage), mark));
  }
  return items;
}

function drawAngle(
  ang: NonNullable<GeometryState["spec"]["angles"]>[number],
  state: GeometryState,
  ctx: CompileCtx,
  toPage: (x: number, y: number) => [number, number],
): DisplayItem[] {
  const a = pageOf(state, ang.a, toPage);
  const v = pageOf(state, ang.v, toPage);
  const b = pageOf(state, ang.b, toPage);
  if (!a || !v || !b) {
    return [];
  }
  const items: DisplayItem[] = [];
  if (ang.mark === "right") {
    const sq = rightSquare(v, a, b);
    if (sq) {
      items.push(strokePoly(sq.map(xy), ctx, ANGLE_MARK_WIDTH_MM));
    }
  }
  if (ang.mark === "equal") {
    items.push(...drawEqual(v, a, b, ang.style ?? "arc", ang.ticks ?? 1, ctx));
  }
  if (ang.label) {
    const at = angleLabelAt(v, a, b);
    if (at) {
      items.push(labelAt(at.x, at.y, ang.label, ctx));
    }
  }
  return items;
}

function drawSegMark(
  mark: NonNullable<GeometryState["spec"]["marks"]>[number],
  state: GeometryState,
  ctx: CompileCtx,
  toPage: (x: number, y: number) => [number, number],
): DisplayItem[] {
  const a = pageOf(state, mark.a, toPage);
  const b = pageOf(state, mark.b, toPage);
  if (!a || !b) {
    return [];
  }
  const items: DisplayItem[] = [];
  if ((mark.style ?? "tick") === "arc") {
    items.push(...drawSegArc(a, b, mark, ctx));
    return items;
  }
  if ((mark.style ?? "tick") === "circle") {
    const rings = segmentCircles(a, b);
    for (const ring of rings ?? []) {
      items.push(disc(ring, ctx, false));
    }
    if (mark.label && rings?.[0]) {
      items.push(segLabel(a, b, mark.label, ctx));
    }
    return items;
  }
  const ticks = segmentTicks(a, b, mark.ticks);
  for (const tick of ticks ?? []) {
    items.push(strokePoly(tick.map(xy), ctx));
  }
  if (mark.label && ticks?.[0]) {
    items.push(segLabel(a, b, mark.label, ctx));
  }
  return items;
}

function drawSegArc(
  a: Point,
  b: Point,
  mark: NonNullable<GeometryState["spec"]["marks"]>[number],
  ctx: CompileCtx,
): DisplayItem[] {
  const bow = segmentBow(a, b, mark.distance, mark.side ?? "left");
  if (!bow) {
    return [];
  }
  const label = mark.label;
  const size = ctx.style.textSize;
  const apex = bowApex(bow);
  const at = label ? arcLabelBaselineAt(apex, label, size) : undefined;
  /* 상자 교차만 지운다. 폭 갭은 높이로 지나가는 점선을 남긴다. */
  const rect = at && label ? labelClipRect(at, label, size) : undefined;
  const runs = rect ? clipPolyOutside(bow, rect) : [bow];
  const items: DisplayItem[] = [];
  for (const run of runs) {
    for (const dash of mark.lineStyle ? [run] : dashPoly(run)) {
      /* 변 호만 얇게. 틱·등각 호는 기본 선 굵기. */
      items.push(strokePoly(dash.map(xy), ctx, SEG_ARC_WIDTH_MM));
    }
  }
  if (label && at) {
    items.push(labelAt(at.x, at.y, label, ctx));
  }
  return items;
}

function segLabel(
  a: Point,
  b: Point,
  text: string,
  ctx: CompileCtx,
): DisplayItem {
  return labelAt((a.x + b.x) / 2 + 1.2, (a.y + b.y) / 2 - 1.2, text, ctx);
}

function drawEqual(
  v: Point,
  a: Point,
  b: Point,
  style: "arc" | "circle" | "dot",
  ticks: number,
  ctx: CompileCtx,
): DisplayItem[] {
  if (style === "circle") {
    const arc = equalArcs(v, a, b, 1)?.[0];
    const rings = (equalCircles(v, a, b) ?? []).map((mark) =>
      disc(mark, ctx, false, ANGLE_MARK_WIDTH_MM),
    );
    return arc
      ? [strokePoly(arc.map(xy), ctx, ANGLE_MARK_WIDTH_MM), ...rings]
      : rings;
  }
  if (style === "dot") {
    return (equalDots(v, a, b, ticks) ?? []).map((mark) =>
      disc(mark, ctx, true, ANGLE_MARK_WIDTH_MM),
    );
  }
  return (equalArcs(v, a, b, ticks) ?? []).map((arc) =>
    strokePoly(arc.map(xy), ctx, ANGLE_MARK_WIDTH_MM),
  );
}

/**
 * 빈 원 또는 채운 점. fill 이 있으면 속. 없으면 테두리만.
 */
/**
 * @param widthMm 각 마크는 ANGLE_MARK_WIDTH_MM. 변 원은 기본 선.
 */
function disc(
  mark: HollowMark,
  ctx: CompileCtx,
  filled: boolean,
  widthMm = ctx.style.width,
): DisplayItem {
  return {
    op: "circle",
    cx: mark.x,
    cy: mark.y,
    r: mark.r,
    stroke: ctx.style.stroke,
    fill: filled ? ctx.style.stroke : undefined,
    width: widthMm,
  };
}

function pageOf(
  state: GeometryState,
  id: string,
  toPage: (x: number, y: number) => [number, number],
): Point | undefined {
  const pt = state.points.get(id);
  if (!pt) {
    return undefined;
  }
  const [x, y] = toPage(pt.x, pt.y);
  return { x, y };
}

function xy(p: Point): [number, number] {
  return [p.x, p.y];
}

/**
 * @param widthMm 없으면 기본 선. 각은 ANGLE_MARK_WIDTH_MM. 변 호는 SEG_ARC_WIDTH_MM
 */
function strokePoly(
  points: [number, number][],
  ctx: CompileCtx,
  widthMm = ctx.style.width,
): DisplayItem {
  return {
    op: "polyline",
    points,
    stroke: ctx.style.stroke,
    width: widthMm,
  };
}

function labelAt(
  x: number,
  y: number,
  text: string,
  ctx: CompileCtx,
): DisplayItem {
  return {
    op: "text",
    x,
    y,
    text,
    size: ctx.style.textSize,
    fill: ctx.style.textFill,
  };
}
