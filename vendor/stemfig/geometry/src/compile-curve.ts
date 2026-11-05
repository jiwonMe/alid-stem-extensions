/**
 * Path → DisplayItem. frame 네 귀를 샘플 박스로 쓴다.
 * explicit 밴드는 polygon fill. 호스트 clip 이 프레임을 한 번 더 자른다.
 * 샘플은 path-project.plotOf 만 부른다. 여기서는 LRU 캐시와 DisplayItem 변환만.
 */
import {
  fitView,
  MM_TO_PX,
  type DisplayItem,
  type Frame,
  type View,
} from "@stemfig/display";
import { plotPolylines, type ExplicitPlot } from "./math/explicit.ts";
import { bandOutline } from "./math/explicit-envelope.ts";
import { pathOf } from "./path-of.ts";
import { plotOf } from "./path-project.ts";
import type { Path, PathPoint, ViewBox } from "./path.ts";
import type { GeoDef } from "./schema.ts";

/**
 * 같은 (식, 박스, 폭) 의 plot 을 다시 샘플하지 않는다. compile·히트·스냅이 한 프레임에 여러 번 부른다.
 * 식·domain 샘플은 비싸고 나머지 kind 는 싸서 explicit/implicit 만 캐시한다.
 */
const CACHE_MAX = 32;
const plotCache = new Map<string, ExplicitPlot>();

/**
 * figure.frame 네 귀의 수학 좌표. view 로 자르면 contain 여백이 빈다.
 */
export function frameBox(view: View, frame: Frame): ViewBox {
  const { fromLocal } = fitView(view, frame);
  const corners = [
    fromLocal(0, 0),
    fromLocal(frame.w, 0),
    fromLocal(0, frame.h),
    fromLocal(frame.w, frame.h),
  ];
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  return {
    xmin: Math.min(...xs),
    xmax: Math.max(...xs),
    ymin: Math.min(...ys),
    ymax: Math.max(...ys),
  };
}

/**
 * graph/path 한 줄. 파싱 실패면 빈 배열.
 */
export function compileCurve(
  obj: GeoDef,
  points: Map<string, { x: number; y: number }>,
  view: View,
  frame: Frame,
  toPage: (x: number, y: number) => [number, number],
  style: { stroke: string; width: number },
): DisplayItem[] {
  const plot = curvePlot(obj, points, view, frame);
  const items: DisplayItem[] = plot.parts.map((part) => ({
    op: "polyline" as const,
    points: part.map((p) => toPage(p.x, p.y)),
    stroke: style.stroke,
    width: style.width,
  }));
  for (const band of plot.bands) {
    items.push({
      op: "polygon",
      points: bandOutline(band).map((p) => toPage(p.x, p.y)),
      stroke: style.stroke,
      fill: style.stroke,
      width: style.width,
    });
  }
  return items;
}

/**
 * 히트·스냅이 같은 샘플을 쓰게. 밴드는 테두리.
 */
export function curvePolylines(
  obj: GeoDef,
  points: Map<string, { x: number; y: number }>,
  view: View,
  frame: Frame,
): PathPoint[][] {
  return plotPolylines(curvePlot(obj, points, view, frame));
}

/**
 * 히트가 곡선 토막과 띠 열 봉투를 따로 보게. compile 과 같은 캐시.
 */
export function curvePlot(
  obj: GeoDef,
  points: Map<string, { x: number; y: number }>,
  view: View,
  frame: Frame,
): ExplicitPlot {
  const path = pathOf(obj, points);
  if (!path) {
    return { parts: [], bands: [] };
  }
  const box = frameBox(view, frame);
  const widthPx = Math.max(2, frame.w * MM_TO_PX);
  return cachedPlot(obj, path, box, widthPx);
}

/**
 * 캐시 키. ["graph", 식, x0?, x1?] 의 식·domain 과 박스·폭이 같으면 plot 도 같다.
 * pathOf 가 만든 Path 자체가 아니라 def 를 쓰는 이유: Path 는 매 호출 새 객체다.
 */
function plotKey(obj: GeoDef, kind: string, box: ViewBox, widthPx: number): string {
  const domain = `${obj.def[2] ?? ""},${obj.def[3] ?? ""}`;
  const view = `${box.xmin},${box.xmax},${box.ymin},${box.ymax}`;
  return `${kind}\0${obj.def[1]}\0${domain}\0${view}\0${widthPx}`;
}

function cachedPlot(obj: GeoDef, path: Path, box: ViewBox, widthPx: number): ExplicitPlot {
  if (path.kind !== "explicit" && path.kind !== "implicit") {
    return plotOf(path, box, widthPx);
  }
  const key = plotKey(obj, path.kind, box, widthPx);
  const hit = plotCache.get(key);
  if (hit) {
    plotCache.delete(key);
    plotCache.set(key, hit);
    return hit;
  }
  const plot = plotOf(path, box, widthPx);
  plotCache.set(key, plot);
  if (plotCache.size > CACHE_MAX) {
    const first = plotCache.keys().next().value;
    if (first !== undefined) {
      plotCache.delete(first);
    }
  }
  return plot;
}
