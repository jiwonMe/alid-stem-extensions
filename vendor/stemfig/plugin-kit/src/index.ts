/**
 * @stemfig/plugin-kit public API.
 * kind 엔진들이 복붙하던 조각만 모은다. 교과 지식은 없다.
 * @stemfig/host 와 @grida/* 를 import 하지 않는다. 의존은 display + zod.
 */
export { viewSchema } from "./view.ts";
export { pageToLocal, projectView } from "./project.ts";
export type { PageProjection, ProjectionCtx } from "./project.ts";
export { POINT_R_MM } from "./marks.ts";
export {
  closestOnPath,
  paramOnSeg,
  snapRadiusMm,
  snapVertexRadiusMm,
  SNAP_PATH_MM,
  SNAP_PATH_PX,
  SNAP_VERTEX_PX,
} from "./closest-path.ts";
export type { PathSeg, PathSnap } from "./closest-path.ts";
export { closestOnCircle, paramOnCircle } from "./closest-circle.ts";
export type { PathCircle } from "./closest-circle.ts";
export { bisectorAt, rightCorner, sampleArcPoints, shorterSweep } from "./arc.ts";
export type { ArcPoint } from "./arc.ts";
export { splitDash } from "./dash.ts";
export { degreeTex, snapDegrees } from "./angle.ts";
