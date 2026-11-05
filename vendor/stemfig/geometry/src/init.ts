/**
 * 선언 순서 평가. 앞선 id 만 참조. 전방참조는 UNKNOWN_REF.
 * on_path 는 경로 객체가 점보다 앞에 있어야 한다. t 만 진실, xy 는 여기서 품.
 * apply 가 자유점·t 를 고치면 다시 init 을 돌리는 것이 M1 계약.
 * 교점·수선이 이번 배치에서 없으면 points 에서 뺀다. throw 하면 직선이 멈춘다.
 */
import { stemfigError } from "@stemfig/host";
import { dividePoint, isInfiniteExternal } from "./divide.ts";
import { listIntersections, pathGeomOf, pickIntersection } from "./intersect.ts";
import { atT } from "./path.ts";
import { pathOf } from "./path-of.ts";
import { projectPoint } from "./project.ts";
import { isCurveEdge, type GeoDef, type GeometrySpec } from "./schema.ts";

export type Point = { x: number; y: number };

export type GeometryState = {
  spec: GeometrySpec;
  points: Map<string, Point>;
  byId: Map<string, GeoDef>;
};

/**
 * objects 가 비면 빈 작도. 새 figure 가 이 상태다. EMPTY_SHOW 는 던지지 않는다.
 * show 는 객체 필드. 여기서는 좌표만 품는다.
 * @throws StemfigValidationError UNKNOWN_REF | SPEC(중복 id · 외분 m===n)
 */
export function initGeometry(spec: GeometrySpec): GeometryState {
  const points = new Map<string, Point>();
  const byId = new Map<string, GeoDef>();

  for (const [index, obj] of spec.objects.entries()) {
    const path = `spec.objects.${index}`;
    if (byId.has(obj.id)) {
      throw stemfigError("SPEC", `${path}.id`, `duplicate id ${obj.id}`);
    }
    byId.set(obj.id, obj);
    evaluate(obj, points, byId, path);
  }

  checkAnnots(spec, points);
  return { spec, points, byId };
}

function evaluate(
  obj: GeoDef,
  points: Map<string, Point>,
  byId: Map<string, GeoDef>,
  path: string,
): void {
  const def = obj.def;
  switch (def[0]) {
    case "point":
      points.set(obj.id, { x: def[1], y: def[2] });
      return;
    case "on_path": {
      /* kind 목록을 여기 넣지 말 것. pathOf 가 경로다. */
      const pathObj = byId.get(def[1]);
      if (!pathObj) {
        throw stemfigError("UNKNOWN_REF", path, `unknown path ${def[1]}`);
      }
      const geom = pathOf(pathObj, points);
      if (!geom) {
        if (isCurveEdge(pathObj.def[0])) {
          return;
        }
        throw stemfigError("UNKNOWN_REF", path, `unknown path ${def[1]}`);
      }
      if (geom.kind === "implicit") {
        return;
      }
      const at = atT(geom, def[2]);
      if (at) {
        points.set(obj.id, at);
      }
      return;
    }
    case "division": {
      /* 외분 m===n 은 무한대. 스키마가 먼저 막지만 applyField 우회를 여기서도 SPEC. */
      if (isInfiniteExternal(def[3], def[4], def[5])) {
        throw stemfigError("SPEC", path, "external division m===n is infinite");
      }
      const a = mustPoint(points, def[1], path);
      const b = mustPoint(points, def[2], path);
      points.set(obj.id, dividePoint(a, b, def[3], def[4], def[5]));
      return;
    }
    case "intersect": {
      /* 평행·빗나감·index 밖은 점이 없다. SPEC 이면 apply 가 직선을 되돌린다. */
      const ga = mustPath(byId, points, def[1], path);
      const gb = mustPath(byId, points, def[2], path);
      const at = pickIntersection(listIntersections(ga, gb), def[3]);
      if (at) {
        points.set(obj.id, at);
      }
      return;
    }
    case "projection": {
      /* A=B 는 발이 없다. 끝점을 겹치게 끌 수 있어야 한다. */
      const p = mustPoint(points, def[1], path);
      const a = mustPoint(points, def[2], path);
      const b = mustPoint(points, def[3], path);
      const foot = projectPoint(p, a, b);
      if (foot) {
        points.set(obj.id, foot);
      }
      return;
    }
    case "segment":
    case "line":
    case "circle":
      mustPoint(points, def[1], path);
      mustPoint(points, def[2], path);
      return;
    case "parallel_line":
    case "perp_line":
      /* 좌표를 넣지 않는다. A=B 여도 throw 금지. */
      mustPoint(points, def[1], path);
      mustPoint(points, def[2], path);
      mustPoint(points, def[3], path);
      return;
    case "bisector":
      mustPoint(points, def[1], path);
      mustPoint(points, def[2], path);
      mustPoint(points, def[3], path);
      return;
    case "circumcircle":
    case "incircle":
      mustPoint(points, def[1], path);
      mustPoint(points, def[2], path);
      mustPoint(points, def[3], path);
      return;
    case "polygon":
      for (const id of def.slice(1)) {
        mustPoint(points, id, path);
      }
      return;
    case "graph":
    case "path":
      return;
  }
}

/**
 * 각·변 마크는 points 에 넣지 않는다. 없는 점만 UNKNOWN_REF.
 * 선분 객체는 보지 않는다.
 */
function checkAnnots(
  spec: GeometrySpec,
  points: Map<string, Point>,
): void {
  for (const [index, ang] of (spec.angles ?? []).entries()) {
    const path = `spec.angles.${index}`;
    mustPoint(points, ang.a, `${path}.a`);
    mustPoint(points, ang.v, `${path}.v`);
    mustPoint(points, ang.b, `${path}.b`);
  }
  for (const [index, mark] of (spec.marks ?? []).entries()) {
    const path = `spec.marks.${index}`;
    mustPoint(points, mark.a, `${path}.a`);
    mustPoint(points, mark.b, `${path}.b`);
  }
}

function mustPoint(
  points: Map<string, Point>,
  id: string,
  path: string,
): Point {
  const point = points.get(id);
  if (!point) {
    throw stemfigError("UNKNOWN_REF", path, `unknown point ${id}`);
  }
  return point;
}

/**
 * 교점 소스. pathGeomOf 가 되는 경로만. 다각형은 UNKNOWN_REF.
 */
function mustPath(
  byId: Map<string, GeoDef>,
  points: Map<string, Point>,
  id: string,
  path: string,
): NonNullable<ReturnType<typeof pathGeomOf>> {
  const obj = byId.get(id);
  if (!obj) {
    throw stemfigError("UNKNOWN_REF", path, `unknown path ${id}`);
  }
  const geom = pathGeomOf(obj, points);
  if (!geom) {
    throw stemfigError("UNKNOWN_REF", path, `unknown path ${id}`);
  }
  return geom;
}
