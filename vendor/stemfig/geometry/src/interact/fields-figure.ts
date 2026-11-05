/**
 * figure 단위 점 원 토글.
 * 꼭짓점과 교점을 같이 끈다. 손잡이가 없을 때만 연다.
 * 객체 mark 와 AND. 호스트는 key 뜻을 모른다.
 */
import type { FieldPatch, InspectField } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";

const KEY = "markPoints";

/**
 * 꼭짓점·교점 원. 생략은 켠다.
 * @returns boolean 한 칸. 앱은 Checkbox 만 그린다
 */
export function fieldsFigure(state: GeometryState): readonly InspectField[] {
  return [
    {
      key: KEY,
      label: "Point marks",
      type: "boolean",
      value: state.spec.markPoints !== false,
    },
  ];
}

/**
 * figure 토글만. 모르는 key 는 undefined.
 * @returns 새 상태. 해당 없으면 undefined
 */
export function applyFigureField(
  state: GeometryState,
  patch: FieldPatch,
): GeometryState | undefined {
  if (patch.key !== KEY || typeof patch.value !== "boolean") {
    return undefined;
  }
  const next = setFigureMark(state.spec, patch.value);
  return next === state.spec ? state : initGeometry(next);
}

function setFigureMark(spec: GeometrySpec, on: boolean): GeometrySpec {
  if ((spec.markPoints !== false) === on) {
    return spec;
  }
  if (on) {
    const { markPoints: _omit, ...rest } = spec;
    return rest;
  }
  return { ...spec, markPoints: false };
}
