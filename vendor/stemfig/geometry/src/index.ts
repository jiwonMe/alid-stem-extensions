/**
 * math.geometry@1 구현체.
 * 이 패키지 없이 StemfigPlugin 타입만 있는 PR 은 실패다.
 * interact/ 손잡이. compile·init·schema 는 루트.
 * hit/apply 는 자유점·선분·원 둘레·path 제어점. fields 는 점·선분·graph eq·path d.
 * snap 은 점·파생점·경로·교차/중점/원심 feature. 교점·수선의 발은 init 이 다시 푼다.
 * create 는 빈 작도. HUD 링은 없다.
 */
import type { FigureTool, StemfigPlugin } from "@stemfig/host";
import { compileGeometry } from "./compile.ts";
import { anchorsGeometry } from "./interact/anchors.ts";
import { applyGeometry } from "./interact/apply.ts";
import { applyFieldGeometry, fieldsGeometry } from "./interact/fields.ts";
import { hitGeometry } from "./interact/hit.ts";
import { layersGeometry } from "./interact/layers.ts";
import { placeGeometry } from "./interact/place.ts";
import { previewGeometry } from "./interact/preview.ts";
import { removeGeometry } from "./interact/remove.ts";
import { cancelGeometry, guidanceGeometry } from "./interact/guidance.ts";
import { validateFieldGeometry } from "./interact/validate-field.ts";
import { snapGeometry } from "./interact/snap.ts";
import { initGeometry, type GeometryState } from "./init.ts";
import { geometrySpecSchema, type GeometrySpec } from "./schema.ts";

export type { GeoDef, GeometrySpec } from "./schema.ts";
export type { GeometryState } from "./init.ts";

/**
 * spec.objects 의 작도 종류. 호스트는 이 목록을 모른다.
 * 그룹: 기본 작도 / 점 작도 / 파생 경로 / 주석.
 * icon 은 UI IconName 문자열. 이 패키지는 @stemfig/ui 를 import 하지 않는다.
 */
const GEOMETRY_TOOLS: readonly FigureTool[] = [
  { id: "point", label: "Point", icon: "point", shortcut: "P" },
  { id: "segment", label: "Segment", icon: "segment", shortcut: "L" },
  { id: "line", label: "Line", icon: "infiniteLine" },
  { id: "circle", label: "Circle", icon: "circle", shortcut: "C" },
  { id: "polygon", label: "Polygon", icon: "triangle" },
  { id: "sep-construct", separator: true },
  { id: "division", label: "Division", icon: "division" },
  { id: "intersection", label: "Intersection", icon: "intersection" },
  { id: "perpendicular", label: "Perpendicular", icon: "perpendicular" },
  { id: "sep-derived", separator: true },
  { id: "parallel-line", label: "Parallel", icon: "parallelLine" },
  { id: "perpendicular-line", label: "Perp. line", icon: "perpendicularLine" },
  { id: "angle-bisector", label: "Bisector", icon: "angleBisector" },
  { id: "circle-three-points", label: "Circumcircle", icon: "circumcircle" },
  { id: "circle-incircle", label: "Incircle", icon: "incircle" },
  { id: "sep-annot", separator: true },
  { id: "angle-annotation", label: "Angle", icon: "angleAnnotation" },
  { id: "segment-annotation", label: "Marks", icon: "segmentAnnotation" },
  { id: "sep-curve", separator: true },
  { id: "graph", label: "Graph", icon: "graph", shortcut: "G" },
  { id: "path", label: "Path", icon: "path" },
];

/**
 * 빈 작도. objects 는 비운다. 점은 place 가 붙인다.
 * view 가로 10. 세로는 figure.frame 비에 맞춘다. 숫자는 이 한곳.
 * 창은 봉투. spec 에 넣지 않는다.
 * @param frame 새 figure.frame. x,y 는 안 쓴다
 * @returns 호스트가 figure.spec / figure.view 에 넣는 값
 */
function seedGeometry(frame: { w: number; h: number }): {
  spec: GeometrySpec;
  view: { xmin: number; xmax: number; ymin: number; ymax: number };
  interaction: { handles: string[]; invariants: string[] };
} {
  const spanX = 10;
  const spanY = frame.w > 0 ? (spanX * frame.h) / frame.w : 10;
  return {
    spec: {
      objects: [],
    },
    view: {
      xmin: -0.5,
      xmax: spanX + 0.5,
      ymin: -0.5,
      ymax: spanY + 0.5,
    },
    interaction: { handles: [], invariants: [] },
  };
}

/** 기하 엔진의 단일 등록 객체. 호스트는 아래 선택 능력만 호출한다. */
export const mathGeometryPlugin: StemfigPlugin<GeometrySpec, GeometryState> = {
  kind: "math.geometry",
  version: 1,
  specSchema: geometrySpecSchema,
  init: initGeometry,
  compile: compileGeometry,
  hit: hitGeometry,
  apply: applyGeometry,
  applyField: applyFieldGeometry,
  remove: removeGeometry,
  cancel: cancelGeometry,
  guidance: guidanceGeometry,
  validateField: validateFieldGeometry,
  fields: fieldsGeometry,
  toSpec: (state) => state.spec,
  anchors: anchorsGeometry,
  layers: layersGeometry,
  tools: GEOMETRY_TOOLS,
  place: placeGeometry,
  preview: previewGeometry,
  snap: snapGeometry,
  create: {
    label: "Geometry",
    icon: "geometry",
    seed: seedGeometry,
  },
};
