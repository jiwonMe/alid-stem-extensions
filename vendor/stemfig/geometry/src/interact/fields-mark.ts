/**
 * 점 원 mark 토글.
 * 라벨·show 와 별개. 원은 끄고 글자만 남길 때 쓴다.
 * 호스트는 key 뜻을 모른다.
 */
import type { InspectField } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { isMarkShown } from "../mark-role.ts";
import { isPointDef, type GeometrySpec } from "../schema.ts";

/**
 * 패널 Mark 행. 값은 obj.mark !== false.
 * @param state init 결과
 * @param id objects id
 * @returns boolean 행. 앱은 Checkbox 만 그린다
 */
export function markField(state: GeometryState, id: string): InspectField {
  const obj = state.byId.get(id);
  return {
    key: "mark",
    label: "Mark",
    type: "boolean",
    value: obj ? isMarkShown(obj) : false,
  };
}

/**
 * 점 다섯 종류만. 선·원에 오면 문서를 유지.
 * @param state init 결과
 * @param id objects id
 * @param kind obj.def[0]
 * @param on true 면 필드를 빼고, false 면 mark: false
 * @returns 새 상태. 점 종류가 아니면 undefined
 */
export function applyMark(
  state: GeometryState,
  id: string,
  kind: string,
  on: boolean,
): GeometryState | undefined {
  if (!isPointDef(kind)) {
    return undefined;
  }
  return initGeometry(setObjectMark(state.spec, id, on));
}

function setObjectMark(spec: GeometrySpec, id: string, on: boolean): GeometrySpec {
  const obj = spec.objects.find((item) => item.id === id);
  if (!obj || isMarkShown(obj) === on) {
    return spec;
  }
  return {
    ...spec,
    objects: spec.objects.map((item) => {
      if (item.id !== id) {
        return item;
      }
      if (on) {
        const { mark: _omit, ...rest } = item;
        return rest;
      }
      return { ...item, mark: false };
    }),
  };
}
