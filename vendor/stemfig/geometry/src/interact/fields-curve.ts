/**
 * graph/path 패널. eq·d 는 쓰기 전 검증. 실패면 문서 유지.
 */
import type { FieldPatch, InspectField } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { equationOk, parseEquation } from "../math/equation.ts";
import { dOk } from "../math/svg-path.ts";
import { isCurveEdge, type GeoDef, type GeometrySpec } from "../schema.ts";
import { showField } from "./fields-show.ts";

/**
 * 곡선 행. 아니면 undefined.
 */
export function fieldsCurve(
  state: GeometryState,
  obj: GeoDef,
): InspectField[] | undefined {
  if (!isCurveEdge(obj.def[0])) {
    return undefined;
  }
  if (obj.def[0] === "graph") {
    const x0 = obj.def.length === 4 ? obj.def[2] : 0;
    const x1 = obj.def.length === 4 ? obj.def[3] : 1;
    const axis = domainAxis(obj.def[1]);
    return [
      { key: "eq", label: "eq", type: "text", value: obj.def[1] },
      {
        key: "auto",
        label: "Auto domain",
        type: "boolean",
        value: obj.def.length !== 4,
      },
      num("x0", `${axis}0`, x0, obj.def.length !== 4),
      num("x1", `${axis}1`, x1, obj.def.length !== 4),
      text("label", "Label", obj.label ?? "", false),
      showField(state, obj.id),
    ];
  }
  if (obj.def[0] !== "path") {
    return undefined;
  }
  return [
    { key: "d", label: "d", type: "text", value: obj.def[1] },
    text("label", "Label", obj.label ?? "", false),
    showField(state, obj.id),
  ];
}

/**
 * eq / auto / x0 / x1 / d. 모르는 key 면 undefined.
 */
export function applyCurveField(
  state: GeometryState,
  obj: GeoDef,
  patch: FieldPatch,
): GeometryState | undefined {
  if (obj.def[0] === "graph") {
    return applyGraph(state, obj, patch);
  }
  if (obj.def[0] === "path") {
    if (patch.key !== "d" || typeof patch.value !== "string") {
      return undefined;
    }
    if (!dOk(patch.value)) {
      return state;
    }
    return initGeometry(setDef(state.spec, obj.id, ["path", patch.value]));
  }
  return undefined;
}

function applyGraph(
  state: GeometryState,
  obj: GeoDef,
  patch: FieldPatch,
): GeometryState | undefined {
  if (obj.def[0] !== "graph") {
    return undefined;
  }
  if (patch.key === "eq" && typeof patch.value === "string") {
    if (!equationOk(patch.value)) {
      return state;
    }
    const def =
      obj.def.length === 4
        ? (["graph", patch.value, obj.def[2], obj.def[3]] as const)
        : (["graph", patch.value] as const);
    return initGeometry(setDef(state.spec, obj.id, [...def]));
  }
  if (patch.key === "auto" && typeof patch.value === "boolean") {
    if (patch.value) {
      return initGeometry(setDef(state.spec, obj.id, ["graph", obj.def[1]]));
    }
    if (obj.def.length === 4) {
      return state;
    }
    return initGeometry(setDef(state.spec, obj.id, ["graph", obj.def[1], 0, 1]));
  }
  if ((patch.key === "x0" || patch.key === "x1") && typeof patch.value === "number") {
    if (obj.def.length !== 4) {
      return state;
    }
    const x0 = patch.key === "x0" ? patch.value : obj.def[2];
    const x1 = patch.key === "x1" ? patch.value : obj.def[3];
    if (x0 === x1) {
      return state;
    }
    return initGeometry(setDef(state.spec, obj.id, ["graph", obj.def[1], x0, x1]));
  }
  return undefined;
}

/**
 * 패널 정의역 라벨. x=g(y) 면 y0/y1. 파싱 실패는 x 로 두고 원문을 보여 준다.
 */
function domainAxis(src: string): "x" | "y" {
  try {
    const eq = parseEquation(src, "fn");
    return eq.kind === "explicit" ? eq.along : "x";
  } catch {
    return "x";
  }
}

function setDef(spec: GeometrySpec, id: string, def: GeoDef["def"]): GeometrySpec {
  return {
    ...spec,
    objects: spec.objects.map((item) => (item.id === id ? { ...item, def } : item)),
  };
}

function num(
  key: string,
  label: string,
  value: number,
  disabled: boolean,
): InspectField {
  return { key, label, type: "number", value, disabled };
}

function text(
  key: string,
  label: string,
  value: string,
  disabled: boolean,
): InspectField {
  return { key, label, type: "text", value, disabled };
}
