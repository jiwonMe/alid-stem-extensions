/**
 * 파생 직선·원 패널.
 * show·label·참조점 읽기 전용. 이등분만 mode.
 * 해당 없을 때 행을 숨기지 않는다. 호스트는 key 뜻을 모른다.
 */
import type { FieldPatch, InspectField } from "@stemfig/host";
import type { BisectorMode } from "../derived-line.ts";
import { initGeometry, type GeometryState } from "../init.ts";
import { isDerivedEdge, type GeometrySpec } from "../schema.ts";
import { showField } from "./fields-show.ts";

/**
 * 파생 EDGE 행. 아니면 undefined.
 */
export function fieldsDerived(
  state: GeometryState,
  obj: GeometrySpec["objects"][number],
): InspectField[] | undefined {
  if (!isDerivedEdge(obj.def[0])) {
    return undefined;
  }
  const label = obj.label ?? "";
  const rows: InspectField[] = [
    ...refRows(obj),
    text("label", "Label", label, false),
    showField(state, obj.id),
  ];
  if (obj.def[0] === "bisector") {
    rows.splice(
      rows.length - 2,
      0,
      choice("mode", "Mode", obj.def[4], [
        { value: "internal", label: "Internal" },
        { value: "external", label: "External" },
      ]),
    );
  }
  return rows;
}

/**
 * 이등분 mode 만. 모르는 key 는 undefined.
 */
export function applyDerivedField(
  state: GeometryState,
  obj: GeometrySpec["objects"][number],
  patch: FieldPatch,
): GeometryState | undefined {
  if (obj.def[0] !== "bisector" || patch.key !== "mode") {
    return undefined;
  }
  if (patch.value !== "internal" && patch.value !== "external") {
    return state;
  }
  return initGeometry(setBisectorMode(state.spec, obj.id, patch.value));
}

function refRows(obj: GeometrySpec["objects"][number]): InspectField[] {
  const head = obj.def[0];
  if (head === "parallel_line" || head === "perp_line") {
    return [
      text("p", "P", obj.def[1], true),
      text("a", "A", obj.def[2], true),
      text("b", "B", obj.def[3], true),
    ];
  }
  if (head === "bisector") {
    return [
      text("a", "A", obj.def[1], true),
      text("v", "V", obj.def[2], true),
      text("b", "B", obj.def[3], true),
    ];
  }
  if (head === "circumcircle" || head === "incircle") {
    return [
      text("a", "A", obj.def[1], true),
      text("b", "B", obj.def[2], true),
      text("c", "C", obj.def[3], true),
    ];
  }
  return [];
}

function setBisectorMode(
  spec: GeometrySpec,
  id: string,
  mode: BisectorMode,
): GeometrySpec {
  return {
    ...spec,
    objects: spec.objects.map((obj) =>
      obj.id === id && obj.def[0] === "bisector"
        ? { ...obj, def: ["bisector", obj.def[1], obj.def[2], obj.def[3], mode] }
        : obj,
    ),
  };
}

function text(
  key: string,
  label: string,
  value: string,
  disabled: boolean,
): InspectField {
  return { key, label, type: "text", value, disabled };
}

function choice(
  key: string,
  label: string,
  value: string,
  options: { value: string; label: string }[],
): InspectField {
  return { key, label, type: "enum", value, options };
}
