/**
 * 축 화살·이름·원점 O. 눈금은 compile-chrome.
 * 라벨은 $...$ 로 남겨 MathJax 가 이탤릭 조판하게.
 */
import { AXES_DEFAULT, axisOn, axisPos, type Axes } from "./chrome.ts";
import { axisDeltoid, axisRailX, axisRailY, resolvedLabel } from "./chrome-arrow.ts";
import type { View } from "./fit-view.ts";
import type { ResolvedStyle } from "./style.ts";
import { measureLabelMm } from "./svg/measure-label.ts";
import type { DisplayItem, Frame } from "./types.ts";

type ToPage = (x: number, y: number) => [number, number];

/**
 * stealth 화살 → 축 이름 → 원점. 끈 축은 건너뛴다.
 */
export function compileAxisMarks(
  view: View,
  frame: Frame,
  axes: Axes,
  style: ResolvedStyle,
  toPage: ToPage,
): DisplayItem[] {
  const items: DisplayItem[] = [];
  const x0 = axisPos(view.xmin, view.xmax);
  const y0 = axisPos(view.ymin, view.ymax);
  if (axisOn(axes, "x")) {
    const stroke = axes.x?.stroke ?? axes.stroke ?? style.stroke;
    const { tail, tip } = axisRailX(frame, toPage(view.xmin, y0)[1]);
    if (axes.arrows !== false) {
      const arrow = axisDeltoid(tip, tail, stroke);
      if (arrow) {
        items.push(arrow);
      }
    }
    const label = resolvedLabel(axes.x?.label, AXES_DEFAULT.xLabel);
    if (label) {
      items.push(labelBelowMarker(tip, label, style));
    }
  }
  if (axisOn(axes, "y")) {
    const stroke = axes.y?.stroke ?? axes.stroke ?? style.stroke;
    const { tail, tip } = axisRailY(frame, toPage(x0, view.ymin)[0]);
    if (axes.arrows !== false) {
      const arrow = axisDeltoid(tip, tail, stroke);
      if (arrow) {
        items.push(arrow);
      }
    }
    const label = resolvedLabel(axes.y?.label, AXES_DEFAULT.yLabel);
    if (label) {
      items.push(labelLeftOfMarker(tip, label, style));
    }
  }
  const origin = originLabel(view, axes, style, toPage);
  if (origin) {
    items.push(origin);
  }
  return items;
}

/**
 * 두 축이 원점에서 만날 때만 O. 가장자리 축에는 쓰지 않는다.
 */
function originLabel(
  view: View,
  axes: Axes,
  style: ResolvedStyle,
  toPage: ToPage,
): DisplayItem | undefined {
  if (axes.origin === false) {
    return undefined;
  }
  if (!axisOn(axes, "x") || !axisOn(axes, "y")) {
    return undefined;
  }
  if (!(view.xmin <= 0 && 0 <= view.xmax && view.ymin <= 0 && 0 <= view.ymax)) {
    return undefined;
  }
  const text = resolvedLabel(axes.originLabel, AXES_DEFAULT.originLabel);
  if (!text) {
    return undefined;
  }
  const [ox, oy] = toPage(0, 0);
  const box = measureLabelMm(text, style.textSize);
  const gap = AXES_DEFAULT.originGap;
  /* 상자 전체가 원점 왼쪽 아래. baseline 이 아니다. */
  return endLabel(ox - gap - box.w, oy + gap - box.y, text, style);
}

/**
 * 마커 바로 아래. 가로 가운데는 화살 몸통.
 * baseline 이 아니라 조판 상자로 맞춘다.
 */
function labelBelowMarker(
  tip: [number, number],
  text: string,
  style: ResolvedStyle,
): DisplayItem {
  const box = measureLabelMm(text, style.textSize);
  const midX = tip[0] - AXES_DEFAULT.arrowLen / 2;
  const top = tip[1] + AXES_DEFAULT.arrowHalf + AXES_DEFAULT.labelPad;
  return endLabel(midX - box.w / 2, top - box.y, text, style);
}

/**
 * 마커 바로 왼쪽. 세로는 화살 몸통 가운데.
 */
function labelLeftOfMarker(
  tip: [number, number],
  text: string,
  style: ResolvedStyle,
): DisplayItem {
  const box = measureLabelMm(text, style.textSize);
  const midY = tip[1] + AXES_DEFAULT.arrowLen / 2;
  const right = tip[0] - AXES_DEFAULT.arrowHalf - AXES_DEFAULT.labelPad;
  return endLabel(right - box.w, midY - box.y - box.h / 2, text, style);
}

function endLabel(
  x: number,
  y: number,
  text: string,
  style: ResolvedStyle,
): DisplayItem {
  return {
    op: "text",
    x,
    y,
    text,
    size: style.textSize,
    fill: style.textFill,
  };
}
