/**
 * GeoDef → Path. element/ 만 곡선 def[0] 을 나열한다.
 * pathGeomOf 는 analytic. view 는 여기 없다.
 * 호스트는 이 모듈을 모른다.
 */
import { graphPath } from "./element/graph.ts";
import { svgPathPath } from "./element/svgpath.ts";
import { pathGeomOf } from "./intersect.ts";
import type { Path } from "./path.ts";
import type { GeoDef } from "./schema.ts";

/**
 * 선·원은 pathGeomOf. graph/path 는 element.
 * @param obj objects 한 줄
 * @param points 풀린 점. 곡선은 안 쓴다
 */
export function pathOf(
  obj: GeoDef,
  points: Map<string, { x: number; y: number }>,
): Path | undefined {
  const analytic = pathGeomOf(obj, points);
  if (analytic) {
    return analytic;
  }
  if (obj.def[0] === "graph") {
    return graphPath(obj);
  }
  if (obj.def[0] === "path") {
    return svgPathPath(obj);
  }
  return undefined;
}
