/**
 * 역학 작도의 페이지 mm 선·화살촉·라벨 배치.
 * 물체 관계는 init의 파생 상태만 읽고 물리량을 계산하지 않는다.
 * DisplayList가 경계다. 렌더러나 앱을 import하지 않으며 편집 손잡이도 같은 라벨 기준점을 쓴다.
 */
import { measureLabelMm, stealthHead, stealthNotch, type DisplayItem, type ResolvedStyle } from "@stemfig/display";
import { splitDash } from "@stemfig/plugin-kit";
import { ARROW_HALF_MM, ARROW_LEN_MM, DASH_OFF_MM, DASH_ON_MM, DIM_EXT_MM, DIM_GAP_MM, DOT_OFF_MM, DOT_ON_MM } from "./print-style.ts";
import type { MechanicsObject, Vec } from "./schema.ts";
import type { MechanicsState } from "./init.ts";
import { referencePoint } from "./init.ts";
/* 페이지 좌표 계산의 잔차만 버린다. 실제 작도 최소 길이를 제한하는 값이 아니다. */
const EPSILON = 1e-9;

/**
 * 점선은 DisplayList 선분으로 나눠 SVG와 화면에 같은 간격을 보낸다.
 * @param points 이미 투영한 페이지 mm 경로
 * @param style 호스트에서 상속한 단색 선 스타일
 * @param dashed true면 점선 또는 점점선으로 나눈다
 * @param width 페이지 mm. 생략하면 상속 선폭
 * @param kind dashed 일 때의 무늬. dot 은 짧은 켜짐이다
 * @returns 선 목록. 두 점 미만이거나 길이가 0인 경로는 빈 목록이며 입력은 바꾸지 않는다
 */
export function strokePath(points: Vec[], style: ResolvedStyle, dashed = false, width = style.width, kind: "dash" | "dot" = "dash"): DisplayItem[] {
  if (points.length < 2) return [];
  const line = (part: Vec[]): DisplayItem => ({ op: "polyline", points: part, stroke: style.stroke, width });
  const moved = points.some((point) => Math.hypot(point[0] - points[0]![0], point[1] - points[0]![1]) > EPSILON);
  if (!dashed) return moved ? [line(points)] : [];
  const on = kind === "dot" ? DOT_ON_MM : DASH_ON_MM;
  const off = kind === "dot" ? DOT_OFF_MM : DASH_OFF_MM;
  return splitDash(points, on, off).map(line);
}

/**
 * 화살촉은 축과 같은 stealth 다각형이다. 짧은 화살은 전체의 1/3까지 줄인다.
 * @param tip 페이지 mm 끝점
 * @param from 화살표가 출발하는 쪽 페이지 mm 점
 * @param style 상속 스타일. 채움도 선 색을 따른다
 * @returns 길이가 0이면 빈 목록
 */
export function arrowHead(tip: Vec, from: Vec, style: ResolvedStyle): DisplayItem[] {
  const metrics = arrowMetrics(tip, from);
  if (!metrics) return [];
  const head = stealthHead(tip, from, style.stroke, metrics);
  return head ? [head] : [];
}

/**
 * 몸통이 끊기는 홈. 선이 꼭짓점까지 가면 둥근 이음이 촉을 덮는다.
 * @param tip 페이지 mm 끝점
 * @param from 출발 점
 * @returns 페이지 mm. 길이가 0이면 tip
 */
export function arrowNotch(tip: Vec, from: Vec): Vec {
  const metrics = arrowMetrics(tip, from);
  return metrics ? stealthNotch(tip, from, metrics) ?? tip : tip;
}

function arrowMetrics(tip: Vec, from: Vec): { len: number; half: number } | undefined {
  const length = Math.hypot(tip[0] - from[0], tip[1] - from[1]);
  if (length < EPSILON) return undefined;
  const len = Math.min(ARROW_LEN_MM, length / 3);
  return { len, half: ARROW_HALF_MM * len / ARROW_LEN_MM };
}

/**
 * 치수 보조선. 기준점에서 띄우고 치수선 밖으로 조금 나간다.
 * @param from 기준점 페이지 mm
 * @param to 치수선 끝 페이지 mm
 * @returns 너무 짧으면 빈 배열
 */
export function extensionLine(from: Vec, to: Vec): Vec[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  if (length < DIM_GAP_MM + 0.2) return [];
  const ux = dx / length;
  const uy = dy / length;
  return [[from[0] + ux * DIM_GAP_MM, from[1] + uy * DIM_GAP_MM], [to[0] + ux * DIM_EXT_MM, to[1] + uy * DIM_EXT_MM]];
}

/**
 * 치수선의 양 끝을 장면 좌표로 구한다. offset은 두 기준점의 평균에서 더한다.
 * @param object 수평·수직 치수 객체
 * @param state init이 참조를 검증한 상태
 * @returns 장면 y-up 좌표. 누락 참조는 init 계약 위반이므로 referencePoint의 오류를 전파한다
 */
export function dimensionEnds(object: Extract<MechanicsObject, { type: "dimension" }>, state: MechanicsState): [Vec, Vec] {
  const a = referencePoint(object.a, state);
  const b = referencePoint(object.b, state);
  if (object.axis === "horizontal") {
    const y = (a[1] + b[1]) / 2 + object.offset;
    return [[a[0], y], [b[0], y]];
  }
  const x = (a[0] + b[0]) / 2 + object.offset;
  return [[x, a[1]], [x, b[1]]];
}

/** 치수선 구멍에 필요한 라벨 상자. 배치 계산은 labels 가 맡는다. */
export type ShaftLabel = { x: number; y: number; text: string; size: number };

/**
 * 치수선이 실제 라벨 상자를 통과하는 부분만 비운다. 라벨 이동도 같은 상자를 따른다.
 * 호출 전에 화살 홈만큼 양 끝을 들여 놓는다.
 * @param a 페이지 mm 시작점
 * @param b 페이지 mm 끝점
 * @param label 라벨 baseline. 없으면 선을 자르지 않는다
 * @returns 최대 두 선 조각. 치수선이 0 길이면 빈 목록이다
 */
export function dimensionShaft(a: Vec, b: Vec, label: ShaftLabel | undefined): Vec[][] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < EPSILON) return [];
  if (!label) return [[a, b]];
  const box = measureLabelMm(label.text, label.size);
  const horizontal = Math.abs(a[1] - b[1]) < EPSILON;
  const main = horizontal ? 0 : 1;
  const other = 1 - main;
  const low: Vec = [label.x + box.x - DIM_GAP_MM, label.y + box.y - DIM_GAP_MM];
  const high: Vec = [label.x + box.x + box.w + DIM_GAP_MM, label.y + box.y + box.h + DIM_GAP_MM];
  if (a[other]! < low[other]! || a[other]! > high[other]!) return [[a, b]];
  const first = (low[main]! - a[main]!) / (b[main]! - a[main]!);
  const second = (high[main]! - a[main]!) / (b[main]! - a[main]!);
  const from = Math.max(0, Math.min(first, second));
  const to = Math.min(1, Math.max(first, second));
  if (from >= to) return [[a, b]];
  const at = (t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return [...(from > 0 ? [[a, at(from)]] : []), ...(to < 1 ? [[at(to), b]] : [])];
}
