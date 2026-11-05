/**
 * 객체 show 토글.
 * compile 만 이 필드를 본다. objects·좌표는 남긴다.
 * 호스트는 key 뜻을 모른다. 주석 id 는 여기 오기 전에 빠진다.
 */
import type { InspectField } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { isDerivedEdge, isShown, type GeometrySpec } from "../schema.ts";

/**
 * 패널 Show 행. 값은 obj.show !== false.
 * @param state init 결과
 * @param id objects id
 * @returns boolean 행. 앱은 Checkbox 만 그린다
 */
export function showField(state: GeometryState, id: string): InspectField {
  const obj = state.byId.get(id);
  return {
    key: "show",
    label: "Show",
    type: "boolean",
    value: obj ? isShown(obj) : false,
  };
}

/**
 * 점·선·파생 EDGE 만 켠다. 모르는 kind 는 문서를 유지.
 * @param state init 결과
 * @param id objects id
 * @param kind obj.def[0]
 * @param on true 면 필드를 빼고, false 면 show: false
 * @returns 새 상태. 허용 kind 가 아니면 undefined
 */
export function applyShow(
  state: GeometryState,
  id: string,
  kind: string,
  on: boolean,
): GeometryState | undefined {
  if (!canToggleShow(kind)) {
    return undefined;
  }
  return initGeometry(setObjectShow(state.spec, id, on));
}

/**
 * objects 에 있는 점·경로만. 각·변 마크 kind 는 false.
 */
function canToggleShow(kind: string): boolean {
  return (
    kind === "point" ||
    kind === "on_path" ||
    kind === "division" ||
    kind === "intersect" ||
    kind === "projection" ||
    kind === "segment" ||
    kind === "line" ||
    kind === "graph" ||
    kind === "path" ||
    isDerivedEdge(kind)
  );
}

function setObjectShow(spec: GeometrySpec, id: string, on: boolean): GeometrySpec {
  const obj = spec.objects.find((item) => item.id === id);
  if (!obj || isShown(obj) === on) {
    return spec;
  }
  return {
    ...spec,
    objects: spec.objects.map((item) => {
      if (item.id !== id) {
        return item;
      }
      if (on) {
        const { show: _omit, ...rest } = item;
        return rest;
      }
      return { ...item, show: false };
    }),
  };
}
