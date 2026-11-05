/**
 * 점 원 역할. 꼭짓점은 자유점만. 교점은 두 path 가 지나거나 만남.
 * 자유점은 변 둘이 만나도 교점이 아니다. figure 토글은 둘을 같이 끈다.
 * pathGeomOf 가 경로. 수선의 발은 밑변만 있으면 교점이 아니다.
 * 호스트는 이 모듈을 모른다.
 */
import { paramOnCircle, paramOnSeg } from "@stemfig/plugin-kit";
import { pathGeomOf, type PathGeom, type Point } from "./intersect.ts";
import { isPointDef, type GeoDef, type GeometrySpec } from "./schema.ts";

/* init 부동소수. intersect 1e-10 보다 넓다. */
const ON_PATH_EPS = 1e-8;

/**
 * 꼭짓점. 자유 point 만. 삼각형 꼭짓점은 여기.
 * @param obj objects 한 줄
 */
export function isVertexMark(obj: GeoDef): boolean {
  return obj.def[0] === "point";
}

/**
 * 교점. 두 path 가 지나거나 만남. 자유점은 제외.
 * intersect 는 작도상 두 경로. 수선의 발은 센 경로만.
 * @param obj 점 객체. 선·원이면 false
 * @param objects figure objects. pathGeomOf 후보
 * @param points init 이 푼 좌표
 */
export function isIntersectionMark(
  obj: GeoDef,
  objects: readonly GeoDef[],
  points: Map<string, Point>,
): boolean {
  if (!isPointDef(obj.def[0]) || obj.def[0] === "point") {
    return false;
  }
  if (obj.def[0] === "intersect") {
    return true;
  }
  return incidentPathCount(obj.id, objects, points) >= 2;
}

/**
 * 점 원을 그릴지. show 와 별개. 선·원은 이 값을 안 본다.
 * spec.markPoints 가 false 면 꼭짓점·교점 원을 같이 끈다.
 * 객체 mark: false 가 이긴다.
 * @param obj objects 한 줄
 * @param spec 없으면 객체 mark 만
 * @param points 교점 판정용. 없으면 intersect 만 교점
 */
export function isMarkShown(
  obj: GeoDef,
  spec?: GeometrySpec,
  points?: Map<string, Point>,
): boolean {
  if (obj.mark === false) {
    return false;
  }
  if (!spec) {
    return true;
  }
  if (spec.markPoints === false && isFigurePointMark(obj, spec, points)) {
    return false;
  }
  return true;
}

function isFigurePointMark(
  obj: GeoDef,
  spec: GeometrySpec,
  points?: Map<string, Point>,
): boolean {
  return (
    isVertexMark(obj) ||
    isIntersectionMark(obj, spec.objects, points ?? new Map())
  );
}

/**
 * 이 점을 지나거나 끝으로 만나는 경로 수. 점 객체는 pathGeom 이 없다.
 */
function incidentPathCount(
  pointId: string,
  objects: readonly GeoDef[],
  points: Map<string, Point>,
): number {
  const p = points.get(pointId);
  if (!p) {
    return 0;
  }
  let n = 0;
  for (const obj of objects) {
    const geom = pathGeomOf(obj, points);
    if (geom && liesOn(p, geom)) {
      n += 1;
    }
  }
  return n;
}

function liesOn(p: Point, geom: PathGeom): boolean {
  if (geom.kind === "circle") {
    const r = Math.hypot(geom.through.x - geom.c.x, geom.through.y - geom.c.y);
    const hit = paramOnCircle([p.x, p.y], {
      id: "",
      c: [geom.c.x, geom.c.y],
      r,
    });
    return hit !== undefined && hit.d <= ON_PATH_EPS;
  }
  return (
    paramOnSeg([p.x, p.y], {
      id: "",
      a: [geom.a.x, geom.a.y],
      b: [geom.b.x, geom.b.y],
      unbound: !geom.bound,
    }).d <= ON_PATH_EPS
  );
}
