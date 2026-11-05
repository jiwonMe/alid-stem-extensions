/**
 * 각·변 마크 HUD 앵커. objects 가 아니다.
 * compile-marks 와 같은 글리프. 호스트는 교과를 모른다.
 */
import { projectView } from "@stemfig/plugin-kit";
import type { AnchorsCtx, HandleAnchor } from "@stemfig/host";
import type { GeometryState, Point } from "../init.ts";
import {
  equalArcs,
  equalCircles,
  equalDots,
  rightSquare,
  segmentCircles,
  segmentTicks,
  type HollowMark,
} from "../mark-geom.ts";
import { arcLabelBaselineAt, bowApex } from "../arc-label-pos.ts";
import { labelHandleId } from "../label-handle.ts";
import { segmentBow } from "../seg-label-arc.ts";

/**
 * 각·변 마크 글리프를 HUD 앵커로. handles 잠금은 보지 않는다.
 * 퇴화면 그 칸만 뺀다. 호스트는 교과를 모른다.
 * @param ctx compile 과 같은 프레임·투영
 * @param state init 결과. spec.angles / spec.marks
 * @returns 페이지 mm polyline·circle. 없으면 빈 배열
 */
export function annotAnchors(
  ctx: AnchorsCtx,
  state: GeometryState,
): HandleAnchor[] {
  const { toPage } = projectView(ctx, ctx.view);
  const out: HandleAnchor[] = [];
  for (const ang of state.spec.angles ?? []) {
    out.push(...angleAnchors(ang, state, toPage));
  }
  for (const mark of state.spec.marks ?? []) {
    out.push(...markAnchors(mark, state, toPage, mark.labelSize ?? ctx.style.textSize));
  }
  return out;
}

function angleAnchors(
  ang: NonNullable<GeometryState["spec"]["angles"]>[number],
  state: GeometryState,
  toPage: (x: number, y: number) => [number, number],
): HandleAnchor[] {
  const a = pageOf(state, ang.a, toPage);
  const v = pageOf(state, ang.v, toPage);
  const b = pageOf(state, ang.b, toPage);
  if (!a || !v || !b) {
    return [];
  }
  if (ang.mark === "right") {
    const sq = rightSquare(v, a, b);
    return sq ? [poly(ang.id, sq.map(xy))] : [];
  }
  if (ang.mark !== "equal") {
    return [];
  }
  return equalAnchors(ang.id, v, a, b, ang.style ?? "arc", ang.ticks ?? 1);
}

function markAnchors(
  mark: NonNullable<GeometryState["spec"]["marks"]>[number],
  state: GeometryState,
  toPage: (x: number, y: number) => [number, number],
  sizeMm: number,
): HandleAnchor[] {
  const a = pageOf(state, mark.a, toPage);
  const b = pageOf(state, mark.b, toPage);
  if (!a || !b) {
    return [];
  }
  const style = mark.style ?? "tick";
  if (style === "circle") {
    return (segmentCircles(a, b) ?? []).map((item) =>
      ring(mark.id, item, false),
    );
  }
  if (style === "arc") {
    const bow = segmentBow(a, b, mark.distance, mark.side ?? "left");
    if (!bow) {
      return [];
    }
    const out: HandleAnchor[] = [poly(mark.id, bow.map(xy))];
    if (mark.label) {
      const base = arcLabelBaselineAt(bowApex(bow), mark.label, sizeMm);
      out.push({
        id: labelHandleId(mark.id),
        kind: "text",
        x_mm: base.x,
        y_mm: base.y,
        text: mark.label,
        size_mm: sizeMm,
        owner: mark.id,
      });
    }
    return out;
  }
  return (segmentTicks(a, b, mark.ticks) ?? []).map((tick) =>
    poly(mark.id, tick.map(xy)),
  );
}

function equalAnchors(
  id: string,
  v: Point,
  a: Point,
  b: Point,
  style: "arc" | "circle" | "dot",
  ticks: number,
): HandleAnchor[] {
  if (style === "dot") {
    return (equalDots(v, a, b, ticks) ?? []).map((mark) => ring(id, mark, true));
  }
  if (style === "circle") {
    const arc = equalArcs(v, a, b, 1)?.[0];
    const rings = (equalCircles(v, a, b) ?? []).map((mark) =>
      ring(id, mark, false),
    );
    return arc ? [poly(id, arc.map(xy)), ...rings] : rings;
  }
  return (equalArcs(v, a, b, ticks) ?? []).map((arc) => poly(id, arc.map(xy)));
}

function poly(id: string, points: [number, number][]): HandleAnchor {
  return { id, kind: "polyline", points };
}

function ring(id: string, mark: HollowMark, filled: boolean): HandleAnchor {
  return {
    id,
    kind: "circle",
    cx_mm: mark.x,
    cy_mm: mark.y,
    r_mm: mark.r,
    filled,
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
