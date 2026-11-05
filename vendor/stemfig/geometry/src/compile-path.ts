/**
 * pathGeom → DisplayItem. clip 과 원 투영만.
 * kind 분기는 여기 없다. compile 이 geom 만 넘긴다.
 */
import type { DisplayItem, Frame, View } from "@stemfig/display";
import type { PathGeom } from "./intersect.ts";
import type { Point } from "./init.ts";

/**
 * 선분은 두 점. 무한직선은 figure.frame 끝까지.
 * 플러그인 책임: 창을 채워 그린다. 호스트는 상자 밖을 버릴 뿐.
 * contain 여백까지 채운다. 봉투 view 로 자르면 시트가 비어 보인다.
 * @param geom pathGeomOf 결과
 * @param frame figure.frame. 페이지 mm
 * @param toPage 수학 → 페이지 mm
 * @param style compile ctx.style
 */
export function compilePathGeom(
  geom: PathGeom,
  frame: Frame,
  toPage: (x: number, y: number) => [number, number],
  style: { stroke: string; width: number },
): DisplayItem[] {
  if (geom.kind === "circle") {
    return compileMathCircle(geom.c, geom.through, toPage, style);
  }
  if (geom.bound) {
    return [
      {
        op: "polyline",
        points: [
          toPage(geom.a.x, geom.a.y),
          toPage(geom.b.x, geom.b.y),
        ],
        stroke: style.stroke,
        width: style.width,
      },
    ];
  }
  const clipped = clipLineToFrame(
    xy(toPage(geom.a.x, geom.a.y)),
    xy(toPage(geom.b.x, geom.b.y)),
    frame,
  );
  if (!clipped) {
    return [];
  }
  return [
    {
      op: "polyline",
      points: [
        [clipped[0].x, clipped[0].y],
        [clipped[1].x, clipped[1].y],
      ],
      stroke: style.stroke,
      width: style.width,
    },
  ];
}

/**
 * 무한직선을 figure 네 변과 잘라 두 끝. 좌표는 페이지 mm.
 * 호스트 clipItems 가 한 번 더 자른다. 여기는 창을 채우는 쪽.
 * @param a 직선 위 한 점
 * @param b 다른 한 점. a 와 같으면 null
 * @param frame figure.frame
 * @returns 교점이 둘 미만이면 null
 */
export function clipLineToFrame(
  a: Point,
  b: Point,
  frame: Frame,
): [Point, Point] | null {
  return clipLineToBox(a, b, {
    xmin: frame.x,
    xmax: frame.x + frame.w,
    ymin: frame.y,
    ymax: frame.y + frame.h,
  });
}

function clipLineToBox(
  a: Point,
  b: Point,
  box: View,
): [Point, Point] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return null;
  }
  const ts: number[] = [];
  pushEdgeT(ts, a, dx, dy, box.xmin, "x", box);
  pushEdgeT(ts, a, dx, dy, box.xmax, "x", box);
  pushEdgeT(ts, a, dx, dy, box.ymin, "y", box);
  pushEdgeT(ts, a, dx, dy, box.ymax, "y", box);
  ts.sort((left, right) => left - right);
  if (ts.length < 2) {
    return null;
  }
  const t0 = ts[0]!;
  const t1 = ts[ts.length - 1]!;
  return [
    { x: a.x + t0 * dx, y: a.y + t0 * dy },
    { x: a.x + t1 * dx, y: a.y + t1 * dy },
  ];
}

/** 페이지 mm 타원. contain 이면 rx===ry. */
export type ProjectedRing = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

/**
 * 수학 원을 페이지에 투영. stretch 면 타원.
 * 반지름을 x 에만 실으면 y 스케일이 커도 작은 원으로 남는다.
 * @returns 퇴화면 undefined
 */
export function projectMathCircle(
  center: Point,
  through: Point,
  toPage: (x: number, y: number) => [number, number],
): ProjectedRing | undefined {
  const rMath = Math.hypot(through.x - center.x, through.y - center.y);
  if (rMath === 0) {
    return undefined;
  }
  const [cx, cy] = toPage(center.x, center.y);
  const [eastX] = toPage(center.x + rMath, center.y);
  const [, northY] = toPage(center.x, center.y + rMath);
  return {
    cx,
    cy,
    rx: Math.abs(eastX - cx),
    ry: Math.abs(northY - cy),
  };
}

/** contain 에서 같은 스케일이 맞는지. */
const ISO_EPS = 1e-6;

/**
 * 수학 원 → DisplayItem. 축 스케일이 같으면 circle, 아니면 ellipse.
 * preview·compile 이 같이 쓴다.
 */
export function compileMathCircle(
  center: Point,
  through: Point,
  toPage: (x: number, y: number) => [number, number],
  style: { stroke: string; width: number },
): DisplayItem[] {
  const ring = projectMathCircle(center, through, toPage);
  if (!ring || (ring.rx === 0 && ring.ry === 0)) {
    return [];
  }
  if (Math.abs(ring.rx - ring.ry) <= ISO_EPS * Math.max(1, ring.rx, ring.ry)) {
    return [
      {
        op: "circle",
        cx: ring.cx,
        cy: ring.cy,
        r: ring.rx,
        stroke: style.stroke,
        width: style.width,
      },
    ];
  }
  return [
    {
      op: "ellipse",
      cx: ring.cx,
      cy: ring.cy,
      rx: ring.rx,
      ry: ring.ry,
      stroke: style.stroke,
      width: style.width,
    },
  ];
}

function pushEdgeT(
  ts: number[],
  a: Point,
  dx: number,
  dy: number,
  edge: number,
  axis: "x" | "y",
  box: View,
): void {
  const denom = axis === "x" ? dx : dy;
  if (denom === 0) {
    return;
  }
  const t = (edge - (axis === "x" ? a.x : a.y)) / denom;
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  const on =
    x >= box.xmin - 1e-9 &&
    x <= box.xmax + 1e-9 &&
    y >= box.ymin - 1e-9 &&
    y <= box.ymax + 1e-9;
  if (on) {
    ts.push(t);
  }
}

function xy(pair: [number, number]): Point {
  return { x: pair[0], y: pair[1] };
}
