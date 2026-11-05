/**
 * obj.show !== false 인 객체만 DisplayItem 으로.
 * @grida/* 금지. 페이지 좌표는 fitView + ctx.mmToPage.
 * 점 반지름 POINT_R_MM(지름 0.4mm), 라벨은 labelAngle·labelDistance.
 */
import type { DisplayItem } from "@stemfig/display";
import { POINT_R_MM, projectView } from "@stemfig/plugin-kit";
import type { CompileCtx } from "@stemfig/host";
import { compileCurve } from "./compile-curve.ts";
import { compileMarks } from "./compile-marks.ts";
import { compilePathGeom } from "./compile-path.ts";
import type { GeometryState, Point } from "./init.ts";
import { pathGeomOf } from "./intersect.ts";
import { labelOffsetMm } from "./label-pos.ts";
import { isMarkShown } from "./mark-role.ts";
import { paintItems, resolvePaint } from "./paint.ts";
import { isShown } from "./schema.ts";

/**
 * line 은 figure.frame 끝까지. segment 는 두 점만.
 * circle 은 중심·원주 두 점. stretch 면 ellipse.
 */
export function compileGeometry(
  ctx: CompileCtx,
  state: GeometryState,
): DisplayItem[] {
  const { toPage } = projectView(ctx, ctx.view);
  const items: DisplayItem[] = [];

  for (const obj of state.spec.objects) {
    if (!isShown(obj)) {
      continue;
    }
    const styled = { ...ctx, style: resolvePaint(ctx.style, obj) };
    items.push(...paintItems(drawObject(obj, obj.id, state, styled, toPage), obj));
  }
  items.push(...compileMarks(ctx, state));
  return items;
}

function drawObject(
  obj: GeometryState["spec"]["objects"][number],
  id: string,
  state: GeometryState,
  ctx: CompileCtx,
  toPage: (x: number, y: number) => [number, number],
): DisplayItem[] {
  const { style } = ctx;
  switch (obj.def[0]) {
    case "point":
    case "on_path":
    case "division":
    case "intersect":
    case "projection": {
      const pt = state.points.get(id);
      return pt ? drawPoint(id, pt, state, ctx, toPage) : [];
    }
    case "polygon":
      return [
        {
          op: "polygon",
          points: obj.def.slice(1).map((pid) => toPage(...xy(state, pid))),
          stroke: style.stroke,
          width: style.width,
        },
      ];
    case "segment":
    case "line":
    case "circle":
    case "parallel_line":
    case "perp_line":
    case "bisector":
    case "circumcircle":
    case "incircle": {
      const geom = pathGeomOf(obj, state.points);
      return geom
        ? compilePathGeom(geom, ctx.frame, toPage, style)
        : [];
    }
    case "graph":
    case "path":
      return compileCurve(obj, state.points, ctx.view, ctx.frame, toPage, style);
    default:
      return [];
  }
}

function drawPoint(
  id: string,
  point: Point,
  state: GeometryState,
  ctx: CompileCtx,
  toPage: (x: number, y: number) => [number, number],
): DisplayItem[] {
  const [cx, cy] = toPage(point.x, point.y);
  const obj = state.byId.get(id);
  const items: DisplayItem[] = [];
  /* mark: false 면 원만 뺀다. 라벨·히트는 남긴다. */
  if (obj && isMarkShown(obj, state.spec, state.points)) {
    items.push({
      op: "circle",
      cx,
      cy,
      r: POINT_R_MM,
      stroke: ctx.style.stroke,
      fill: ctx.style.stroke,
      width: ctx.style.width,
    });
  }
  const label = obj?.label;
  if (label) {
    const [dx, dy] = labelOffsetMm(
      obj?.labelAngle,
      label,
      ctx.style.textSize,
      obj?.labelDistance,
    );
    const [lx, ly] = ctx.mmToPage(
      cx - ctx.frame.x + dx,
      cy - ctx.frame.y + dy,
    );
    items.push({
      op: "text",
      x: lx,
      y: ly,
      text: label,
      size: ctx.style.textSize,
      fill: ctx.style.textFill,
    });
  }
  return items;
}

function xy(state: GeometryState, id: string): [number, number] {
  const point = state.points.get(id)!;
  return [point.x, point.y];
}
