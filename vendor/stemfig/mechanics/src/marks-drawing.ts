/**
 * 공·점·각도 호를 페이지 mm 로 그린다.
 * 직각은 측정이 90°일 때만 놓고, 각 숫자는 라벨 모듈이 붙인다.
 * 공의 채움은 종이 색이다. 운동을 계산하지 않는다.
 */
import { DEFAULT_SHEET_FILL, type DisplayItem, type ResolvedStyle } from "@stemfig/display";
import { POINT_R_MM, rightCorner, sampleArcPoints, shorterSweep } from "@stemfig/plugin-kit";
import { strokePath } from "./drawing.ts";
import { referencePoint, type MechanicsState } from "./init.ts";
import { ANGLE_RADIUS_MM, BODY_FILL, inkWidth, RIGHT_SIDE_MM } from "./print-style.ts";
import { rayPoint } from "./rays.ts";
import type { MechanicsObject, Vec } from "./schema.ts";

/**
 * @param object 공·점·각도
 * @param page 장면 좌표를 페이지 mm 로
 * @param style 상속 잉크
 * @param state 해석된 중심과 곡선
 * @returns 해당 레이어에 넣을 항목. 숨김 판정은 호출 측이다
 */
export function drawMark(object: Extract<MechanicsObject, { type: "ball" | "point" | "angle" }>, page: (x: number, y: number) => Vec, style: ResolvedStyle, state: MechanicsState): DisplayItem[] {
  if (object.type === "point") return drawPoint(object, page, style, state);
  if (object.type === "ball") return drawBall(object, page, style, state);
  return drawAngle(object, page, style, state);
}

function drawPoint(object: Extract<MechanicsObject, { type: "point" }>, page: (x: number, y: number) => Vec, style: ResolvedStyle, state: MechanicsState): DisplayItem[] {
  const [cx, cy] = page(...referencePoint(object.at, state));
  return [{ op: "circle", cx, cy, r: POINT_R_MM, stroke: style.stroke, fill: style.stroke, width: 0 }];
}

function drawBall(object: Extract<MechanicsObject, { type: "ball" }>, page: (x: number, y: number) => Vec, style: ResolvedStyle, state: MechanicsState): DisplayItem[] {
  const ball = state.balls.get(object.id);
  if (!ball) return [];
  const [cx, cy] = page(...ball.center);
  const rx = Math.abs(page(ball.center[0] + ball.radius, ball.center[1])[0] - cx);
  const ry = Math.abs(page(ball.center[0], ball.center[1] + ball.radius)[1] - cy);
  const width = inkWidth(style, "body", object.weight);
  const fill = object.dashed ? DEFAULT_SHEET_FILL : object.fill === "ink" ? style.stroke : object.fill === "shade" ? BODY_FILL : DEFAULT_SHEET_FILL;
  const ellipse: DisplayItem = { op: "ellipse", cx, cy, rx, ry, stroke: style.stroke, fill, width: object.dashed ? 0 : width };
  if (!object.dashed) return [ellipse];
  return [ellipse, ...strokePath(oval(cx, cy, rx, ry), style, true, width, object.dash === "dot" ? "dot" : "dash")];
}

function drawAngle(object: Extract<MechanicsObject, { type: "angle" }>, page: (x: number, y: number) => Vec, style: ResolvedStyle, state: MechanicsState): DisplayItem[] {
  const vertex = referencePoint(object.v, state);
  const a = rayPoint(object.a, vertex, state);
  const b = rayPoint(object.b, vertex, state);
  const v = page(...vertex);
  const pa = page(...a);
  const pb = page(...b);
  const width = inkWidth(style, "guide", object.weight);
  if (object.mark === "right") {
    const square = rightCorner(xy(v), xy(pa), xy(pb), RIGHT_SIDE_MM);
    if (!square) return [];
    return strokePath([[square[0].x, square[0].y], [square[1].x, square[1].y], [square[2].x, square[2].y]], style, false, width);
  }
  const radius = object.radius ?? ANGLE_RADIUS_MM;
  const start = Math.atan2(pa[1] - v[1], pa[0] - v[0]);
  const delta = shorterSweep(start, Math.atan2(pb[1] - v[1], pb[0] - v[0]));
  if (Math.abs(delta) < 1e-4) return [];
  const arc = sampleArcPoints(xy(v), radius, start, delta, 24).map((point): Vec => [point.x, point.y]);
  return strokePath(arc, style, object.dashed, width, object.dash === "dot" ? "dot" : "dash");
}

function oval(cx: number, cy: number, rx: number, ry: number): Vec[] {
  const count = Math.max(24, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - 0.02 / Math.max(rx, ry, 0.02)))));
  return Array.from({ length: count + 1 }, (_, index): Vec => {
    const angle = index / count * Math.PI * 2;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

function xy(point: Vec): { x: number; y: number } {
  return { x: point[0], y: point[1] };
}
