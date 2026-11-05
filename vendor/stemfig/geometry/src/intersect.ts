/**
 * 경로 교점. pathGeomOf 가 펼친 선·원만.
 * line 은 무한, segment 는 [0,1]. 선분 밖은 후보에서 뺀다.
 * 평행·일치·원 포함은 degenerate. 호스트는 이 모듈을 모른다.
 */

import { circumcircleOf, incircleOf } from "./derived-circle.ts";
import { bisectorDir, parallelDir, perpDir } from "./derived-line.ts";
import type { GeoDef } from "./schema.ts";

export type Point = { x: number; y: number };

/**
 * init·place 가 같은 식을 쓰게 경로를 좌표로 펼친 것.
 * bound 는 segment. 호스트는 이 타입을 모른다.
 */
export type PathGeom =
  | { kind: "line"; a: Point; b: Point; bound: boolean }
  | { kind: "circle"; c: Point; through: Point };

const EPS = 1e-10;

/**
 * 선·원을 좌표로 펼친다. 새 kind 를 init 에 나열하지 말 것.
 * 파생 직선은 P+dir. 원은 외심/내심. 퇴화면 undefined.
 */
export function pathGeomOf(
  obj: GeoDef,
  points: Map<string, Point>,
): PathGeom | undefined {
  if (obj.def[0] === "segment" || obj.def[0] === "line") {
    const a = points.get(obj.def[1]);
    const b = points.get(obj.def[2]);
    if (!a || !b) {
      return undefined;
    }
    return { kind: "line", a, b, bound: obj.def[0] === "segment" };
  }
  if (obj.def[0] === "circle") {
    const c = points.get(obj.def[1]);
    const through = points.get(obj.def[2]);
    if (!c || !through) {
      return undefined;
    }
    return { kind: "circle", c, through };
  }
  if (obj.def[0] === "parallel_line" || obj.def[0] === "perp_line") {
    return throughLineGeom(obj.def, points);
  }
  if (obj.def[0] === "bisector") {
    return bisectorGeom(obj.def, points);
  }
  if (obj.def[0] === "circumcircle" || obj.def[0] === "incircle") {
    return triCircleGeom(obj.def, points);
  }
  return undefined;
}

function throughLineGeom(
  def: Extract<GeoDef["def"], { 0: "parallel_line" | "perp_line" }>,
  points: Map<string, Point>,
): PathGeom | undefined {
  const p = points.get(def[1]);
  const a = points.get(def[2]);
  const b = points.get(def[3]);
  if (!p || !a || !b) {
    return undefined;
  }
  const dir = def[0] === "parallel_line" ? parallelDir(a, b) : perpDir(a, b);
  if (!dir) {
    return undefined;
  }
  return {
    kind: "line",
    a: p,
    b: { x: p.x + dir.x, y: p.y + dir.y },
    bound: false,
  };
}

function bisectorGeom(
  def: Extract<GeoDef["def"], { 0: "bisector" }>,
  points: Map<string, Point>,
): PathGeom | undefined {
  const a = points.get(def[1]);
  const v = points.get(def[2]);
  const b = points.get(def[3]);
  if (!a || !v || !b) {
    return undefined;
  }
  const dir = bisectorDir(a, v, b, def[4]);
  if (!dir) {
    return undefined;
  }
  return {
    kind: "line",
    a: v,
    b: { x: v.x + dir.x, y: v.y + dir.y },
    bound: false,
  };
}

function triCircleGeom(
  def: Extract<GeoDef["def"], { 0: "circumcircle" | "incircle" }>,
  points: Map<string, Point>,
): PathGeom | undefined {
  const a = points.get(def[1]);
  const b = points.get(def[2]);
  const c = points.get(def[3]);
  if (!a || !b || !c) {
    return undefined;
  }
  const ring = def[0] === "circumcircle" ? circumcircleOf(a, b, c) : incircleOf(a, b, c);
  if (!ring) {
    return undefined;
  }
  return { kind: "circle", c: ring.c, through: ring.through };
}

/**
 * 두 경로의 교점. index 순서는 이 배열.
 * 직선–원: t 작은 순. 원–원: 첫 원 중심 atan2 순.
 * @returns 후보. 평행·일치·포함이면 null
 */
export function listIntersections(
  a: PathGeom,
  b: PathGeom,
): Point[] | null {
  if (a.kind === "circle" && b.kind === "circle") {
    return circleCircle(a, b);
  }
  if (a.kind === "circle") {
    return lineCircle(b as Extract<PathGeom, { kind: "line" }>, a);
  }
  if (b.kind === "circle") {
    return lineCircle(a, b);
  }
  return lineLine(a, b);
}

/**
 * 후보에서 index 번째. 없으면 undefined.
 */
export function pickIntersection(
  hits: Point[] | null,
  index: number,
): Point | undefined {
  if (!hits || index < 0 || index >= hits.length) {
    return undefined;
  }
  return hits[index];
}

function lineLine(
  a: Extract<PathGeom, { kind: "line" }>,
  b: Extract<PathGeom, { kind: "line" }>,
): Point[] | null {
  const dax = a.b.x - a.a.x;
  const day = a.b.y - a.a.y;
  const dbx = b.b.x - b.a.x;
  const dby = b.b.y - b.a.y;
  const den = dax * dby - day * dbx;
  if (Math.abs(den) < EPS) {
    return null;
  }
  const t = ((b.a.x - a.a.x) * dby - (b.a.y - a.a.y) * dbx) / den;
  const s = ((b.a.x - a.a.x) * day - (b.a.y - a.a.y) * dax) / den;
  if (a.bound && (t < -EPS || t > 1 + EPS)) {
    return [];
  }
  if (b.bound && (s < -EPS || s > 1 + EPS)) {
    return [];
  }
  return [{ x: a.a.x + t * dax + 0, y: a.a.y + t * day + 0 }];
}

function lineCircle(
  line: Extract<PathGeom, { kind: "line" }>,
  circle: Extract<PathGeom, { kind: "circle" }>,
): Point[] | null {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const fx = line.a.x - circle.c.x;
  const fy = line.a.y - circle.c.y;
  const r = Math.hypot(circle.through.x - circle.c.x, circle.through.y - circle.c.y);
  const aa = dx * dx + dy * dy;
  if (aa < EPS) {
    return null;
  }
  const bb = 2 * (fx * dx + fy * dy);
  const cc = fx * fx + fy * fy - r * r;
  const disc = bb * bb - 4 * aa * cc;
  if (disc < -EPS) {
    return [];
  }
  const root = Math.sqrt(Math.max(0, disc));
  const ts = [(-bb - root) / (2 * aa), (-bb + root) / (2 * aa)];
  if (root < EPS) {
    ts.pop();
  }
  ts.sort((p, q) => p - q);
  const hits: Point[] = [];
  for (const t of ts) {
    if (line.bound && (t < -EPS || t > 1 + EPS)) {
      continue;
    }
    hits.push({ x: line.a.x + t * dx + 0, y: line.a.y + t * dy + 0 });
  }
  return hits;
}

function circleCircle(
  a: Extract<PathGeom, { kind: "circle" }>,
  b: Extract<PathGeom, { kind: "circle" }>,
): Point[] | null {
  const r1 = Math.hypot(a.through.x - a.c.x, a.through.y - a.c.y);
  const r2 = Math.hypot(b.through.x - b.c.x, b.through.y - b.c.y);
  const dx = b.c.x - a.c.x;
  const dy = b.c.y - a.c.y;
  const d = Math.hypot(dx, dy);
  if (d < EPS) {
    return null;
  }
  if (d > r1 + r2 + EPS || d + EPS < Math.abs(r1 - r2)) {
    return null;
  }
  const u = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - u * u;
  const mx = a.c.x + (u * dx) / d;
  const my = a.c.y + (u * dy) / d;
  if (h2 < -EPS) {
    return null;
  }
  if (h2 < EPS) {
    return [{ x: mx + 0, y: my + 0 }];
  }
  const h = Math.sqrt(h2);
  const rx = (-dy * h) / d;
  const ry = (dx * h) / d;
  const hits = [
    { x: mx + rx + 0, y: my + ry + 0 },
    { x: mx - rx + 0, y: my - ry + 0 },
  ];
  hits.sort((p, q) => angle(a.c, p) - angle(a.c, q));
  return hits;
}

function angle(c: Point, p: Point): number {
  return Math.atan2(p.y - c.y, p.x - c.x);
}

/**
 * 커서에 가장 가까운 교점 한 칸. place 가 쌍을 다시 계산한다.
 * a,b 는 경로 id. 뒤집지 않는다.
 */
export type IntersectPick = {
  a: string;
  b: string;
  index: number;
  point: Point;
};

/**
 * 모든 경로 쌍의 교점 중 커서에 가장 가까운 것.
 * @returns 없으면 undefined
 */
export function nearestIntersection(
  objects: readonly GeoDef[],
  points: Map<string, Point>,
  x: number,
  y: number,
): IntersectPick | undefined {
  let best: IntersectPick | undefined;
  let bestD = Infinity;
  const paths = pathEntries(objects, points);
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      const left = paths[i]!;
      const right = paths[j]!;
      const hits = listIntersections(left.geom, right.geom);
      if (!hits) {
        continue;
      }
      hits.forEach((point, index) => {
        const d = Math.hypot(point.x - x, point.y - y);
        if (d < bestD) {
          bestD = d;
          best = { a: left.id, b: right.id, index, point };
        }
      });
    }
  }
  return best;
}

/** 스냅 feature. 교차·선분 중점·원 중심. 객체 id 없음. */
export function listFeatures(
  objects: readonly GeoDef[],
  points: Map<string, Point>,
): Point[] {
  const out: Point[] = [];
  const paths = pathEntries(objects, points);
  for (const { obj, geom } of paths) {
    if (obj.def[0] === "segment" && geom.kind === "line") {
      out.push({
        x: (geom.a.x + geom.b.x) / 2 + 0,
        y: (geom.a.y + geom.b.y) / 2 + 0,
      });
    }
    if (geom.kind === "circle") {
      out.push({ x: geom.c.x, y: geom.c.y });
    }
  }
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      const hits = listIntersections(paths[i]!.geom, paths[j]!.geom);
      if (!hits) {
        continue;
      }
      out.push(...hits);
    }
  }
  return out;
}

function pathEntries(
  objects: readonly GeoDef[],
  points: Map<string, Point>,
): { id: string; obj: GeoDef; geom: PathGeom }[] {
  const out: { id: string; obj: GeoDef; geom: PathGeom }[] = [];
  for (const obj of objects) {
    const geom = pathGeomOf(obj, points);
    if (!geom) {
      continue;
    }
    out.push({ id: obj.id, obj, geom });
  }
  return out;
}
