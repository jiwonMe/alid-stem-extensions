/**
 * 레이어 패널 행. objects · angles · marks.
 * 호스트는 def[0] 을 모른다. icon 은 UI IconName 문자열.
 */
import type { LayerItem } from "@stemfig/host";
import type { GeometryState } from "../init.ts";
import type { GeoDef } from "../schema.ts";

const OBJECT_META: Record<GeoDef["def"][0], { icon: string; kind: string }> = {
  point: { icon: "point", kind: "Point" },
  on_path: { icon: "point", kind: "On path" },
  division: { icon: "division", kind: "Division" },
  intersect: { icon: "intersection", kind: "Intersect" },
  projection: { icon: "perpendicular", kind: "Projection" },
  segment: { icon: "segment", kind: "Segment" },
  line: { icon: "infiniteLine", kind: "Line" },
  circle: { icon: "circle", kind: "Circle" },
  polygon: { icon: "triangle", kind: "Polygon" },
  parallel_line: { icon: "parallelLine", kind: "Parallel" },
  perp_line: { icon: "perpendicularLine", kind: "Perp. line" },
  bisector: { icon: "angleBisector", kind: "Bisector" },
  circumcircle: { icon: "circumcircle", kind: "Circumcircle" },
  incircle: { icon: "incircle", kind: "Incircle" },
  graph: { icon: "graph", kind: "Graph" },
  path: { icon: "path", kind: "Path" },
};

/**
 * 문서 순서. 숨긴 객체도 남긴다. A:label 은 점 행이 맡는다.
 * @param state init 결과
 * @returns 손잡이 id. 트리 id 는 에디터
 */
export function layersGeometry(state: GeometryState): readonly LayerItem[] {
  const out: LayerItem[] = [];
  for (const obj of state.spec.objects) {
    const meta = OBJECT_META[obj.def[0]];
    out.push({
      id: obj.id,
      title: obj.label || obj.id,
      icon: meta.icon,
      kind: meta.kind,
    });
  }
  for (const ang of state.spec.angles ?? []) {
    out.push({
      id: ang.id,
      title: ang.label || ang.id,
      icon: "angleAnnotation",
      kind: "Angle",
    });
  }
  for (const mark of state.spec.marks ?? []) {
    out.push({
      id: mark.id,
      title: mark.label || mark.id,
      icon: "segmentAnnotation",
      kind: "Mark",
    });
  }
  return out;
}
