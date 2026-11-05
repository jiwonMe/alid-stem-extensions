/**
 * figure.view 위 격자·축·눈금 → DisplayList.
 * 교과 객체를 모른다. 호스트가 플러그인 아이템 앞에 붙인다.
 */
import {
  AXES_DEFAULT,
  GRID_DEFAULT,
  axisOn,
  axisPos,
  axesOn,
  gridOn,
  ticksOn,
  type Axes,
  type Grid,
} from "./chrome.ts";
import { arrowStop, axisRailX, axisRailY, mathLabel } from "./chrome-arrow.ts";
import { formatTick, onMajor, steps } from "./chrome-steps.ts";
import { compileAxisMarks } from "./compile-axis-marks.ts";
import { toPage, type View } from "./fit-view.ts";
import type { ResolvedStyle } from "./style.ts";
import type { DisplayItem, Frame } from "./types.ts";

type ToPage = (x: number, y: number) => [number, number];

/**
 * 격자 → 축 → 눈금 → 축 라벨.
 * 둘 다 꺼져 있으면 빈 배열. 플러그인 아이템은 여기 없다.
 * 투영은 toPage 한 곳. fitView 를 여기서 다시 짜지 않는다.
 */
export function compileChrome(input: {
  view: View;
  frame: Frame;
  style: ResolvedStyle;
  grid?: Grid;
  axes?: Axes;
}): DisplayItem[] {
  const project: ToPage = toPage(input.view, input.frame);
  const items: DisplayItem[] = [];
  if (gridOn(input.grid)) {
    items.push(...gridLines(input.view, input.grid!, project));
  }
  if (axesOn(input.axes)) {
    items.push(...axisLines(input.view, input.frame, input.axes!, input.style, project));
    items.push(...axisTicks(input.view, input.axes!, input.style, project));
    items.push(
      ...compileAxisMarks(input.view, input.frame, input.axes!, input.style, project),
    );
  }
  return items;
}

function gridLines(view: View, grid: Grid, toPage: ToPage): DisplayItem[] {
  const stepX = grid.stepX ?? GRID_DEFAULT.step;
  const stepY = grid.stepY ?? grid.stepX ?? GRID_DEFAULT.step;
  const stroke = grid.stroke ?? GRID_DEFAULT.stroke;
  const width = grid.width ?? GRID_DEFAULT.width;
  const items: DisplayItem[] = [];
  if (grid.minor) {
    const sub = grid.subdivisions ?? GRID_DEFAULT.subdivisions;
    items.push(
      ...vert(view, stepX / sub, stepX, grid.minorStroke ?? GRID_DEFAULT.minorStroke, grid.minorWidth ?? GRID_DEFAULT.minorWidth, toPage),
      ...horz(view, stepY / sub, stepY, grid.minorStroke ?? GRID_DEFAULT.minorStroke, grid.minorWidth ?? GRID_DEFAULT.minorWidth, toPage),
    );
  }
  items.push(
    ...vert(view, stepX, 0, stroke, width, toPage),
    ...horz(view, stepY, 0, stroke, width, toPage),
  );
  return items;
}

function vert(
  view: View,
  step: number,
  skipMajor: number,
  stroke: string,
  width: number,
  toPage: ToPage,
): DisplayItem[] {
  return steps(view.xmin, view.xmax, step, GRID_DEFAULT.maxLines)
    .filter((x) => skipMajor <= 0 || !onMajor(x, skipMajor))
    .map((x) => seg(toPage(x, view.ymin), toPage(x, view.ymax), stroke, width));
}

function horz(
  view: View,
  step: number,
  skipMajor: number,
  stroke: string,
  width: number,
  toPage: ToPage,
): DisplayItem[] {
  return steps(view.ymin, view.ymax, step, GRID_DEFAULT.maxLines)
    .filter((y) => skipMajor <= 0 || !onMajor(y, skipMajor))
    .map((y) => seg(toPage(view.xmin, y), toPage(view.xmax, y), stroke, width));
}

function axisLines(
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
    const width = axes.x?.width ?? axes.width ?? AXES_DEFAULT.width;
    const { tail, tip } = axisRailX(frame, toPage(view.xmin, y0)[1]);
    const end = axes.arrows === false ? tip : (arrowStop(tip, tail) ?? tip);
    items.push(seg(tail, end, stroke, width));
  }
  if (axisOn(axes, "y")) {
    const stroke = axes.y?.stroke ?? axes.stroke ?? style.stroke;
    const width = axes.y?.width ?? axes.width ?? AXES_DEFAULT.width;
    const { tail, tip } = axisRailY(frame, toPage(x0, view.ymin)[0]);
    const end = axes.arrows === false ? tip : (arrowStop(tip, tail) ?? tip);
    items.push(seg(tail, end, stroke, width));
  }
  return items;
}

function axisTicks(
  view: View,
  axes: Axes,
  style: ResolvedStyle,
  toPage: ToPage,
): DisplayItem[] {
  const ticks = axes.ticks;
  if (!ticksOn(ticks)) {
    return [];
  }
  const items: DisplayItem[] = [];
  const x0 = axisPos(view.xmin, view.xmax);
  const y0 = axisPos(view.ymin, view.ymax);
  const labels = ticks?.labels !== false;
  if (axisOn(axes, "x")) {
    const step = ticks?.stepX ?? AXES_DEFAULT.step;
    const stroke = axes.x?.stroke ?? axes.stroke ?? style.stroke;
    const width = axes.x?.width ?? axes.width ?? AXES_DEFAULT.width;
    pushTicks(items, {
      values: steps(view.xmin, view.xmax, step, AXES_DEFAULT.maxTicks),
      at: (t) => toPage(t, y0),
      major: (p) => [p, [p[0], p[1] + AXES_DEFAULT.tickLen]] as const,
      minor: (p) => [p, [p[0], p[1] + AXES_DEFAULT.minorTickLen]] as const,
      labelAt: (p) => [p[0], p[1] + AXES_DEFAULT.labelOffset] as const,
      step,
      minorStep: ticks?.minor
        ? step / (ticks.subdivisions ?? AXES_DEFAULT.subdivisions)
        : 0,
      range: [view.xmin, view.xmax],
      labels,
      stroke,
      width,
      style,
    });
  }
  if (axisOn(axes, "y")) {
    const step = ticks?.stepY ?? AXES_DEFAULT.step;
    const stroke = axes.y?.stroke ?? axes.stroke ?? style.stroke;
    const width = axes.y?.width ?? axes.width ?? AXES_DEFAULT.width;
    pushTicks(items, {
      values: steps(view.ymin, view.ymax, step, AXES_DEFAULT.maxTicks),
      at: (t) => toPage(x0, t),
      major: (p) => [[p[0] - AXES_DEFAULT.tickLen, p[1]], p] as const,
      minor: (p) => [[p[0] - AXES_DEFAULT.minorTickLen, p[1]], p] as const,
      labelAt: (p) => [p[0] - AXES_DEFAULT.labelOffset, p[1]] as const,
      step,
      minorStep: ticks?.minor
        ? step / (ticks.subdivisions ?? AXES_DEFAULT.subdivisions)
        : 0,
      range: [view.ymin, view.ymax],
      labels,
      stroke,
      width,
      style,
    });
  }
  return items;
}

function pushTicks(
  items: DisplayItem[],
  args: {
    values: number[];
    at: (t: number) => [number, number];
    major: (p: [number, number]) => readonly [[number, number], [number, number]];
    minor: (p: [number, number]) => readonly [[number, number], [number, number]];
    labelAt: (p: [number, number]) => [number, number];
    step: number;
    minorStep: number;
    range: [number, number];
    labels: boolean;
    stroke: string;
    width: number;
    style: ResolvedStyle;
  },
): void {
  for (const t of args.values) {
    /* 원점은 O 가 대신한다. 눈금·숫자를 겹치지 않게. */
    if (t === 0) {
      continue;
    }
    const p = args.at(t);
    const [a, b] = args.major(p);
    items.push(seg(a, b, args.stroke, args.width));
    if (args.labels) {
      const [x, y] = args.labelAt(p);
      items.push(tickLabel(x, y, mathLabel(formatTick(t)), args.style));
    }
  }
  if (!(args.minorStep > 0)) {
    return;
  }
  for (const t of steps(args.range[0], args.range[1], args.minorStep, AXES_DEFAULT.maxTicks)) {
    if (onMajor(t, args.step)) {
      continue;
    }
    const [a, b] = args.minor(args.at(t));
    items.push(seg(a, b, args.stroke, args.width * 0.75));
  }
}

function seg(
  a: [number, number],
  b: [number, number],
  stroke: string,
  width: number,
): DisplayItem {
  return { op: "polyline", points: [a, b], stroke, width };
}

function tickLabel(
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
    size: AXES_DEFAULT.tickTextSize,
    fill: style.textFill,
  };
}
