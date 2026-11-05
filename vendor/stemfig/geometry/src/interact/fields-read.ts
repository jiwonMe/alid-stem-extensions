/**
 * 객체 속성 읽기. 좌표·작도 정의는 이 층에서만 InspectField 로 바꾼다.
 * 스타일 행 합성은 fields.ts 가 맡으며 이 모듈은 문서를 변경하지 않는다.
 */
import type { FieldsCtx, InspectField } from "@stemfig/host";
import type { GeometryState } from "../init.ts";
import type { GeometrySpec } from "../schema.ts";
import { fieldsAnnot, fieldsArcLabelPose } from "./fields-annot.ts";
import { fieldsCurve } from "./fields-curve.ts";
import { fieldsDerived } from "./fields-derived.ts";
import { parseLabelHandle } from "../label-handle.ts";
import { LABEL_ANGLE_DEFAULT, LABEL_GAP_MM } from "../label-pos.ts";
import { fieldsFigure } from "./fields-figure.ts";
import { markField } from "./fields-mark.ts";
import { showField } from "./fields-show.ts";
import { pointRole } from "./free.ts";
import { fieldsPathHandle } from "./path-ctrl.ts";

/** @param ctx 선택 손잡이 @param state 현재 작도 @returns 스타일을 제외한 객체 속성 */
export function baseFieldsGeometry(
  ctx: FieldsCtx,
  state: GeometryState,
): readonly InspectField[] {
  if (!ctx.focus) {
    return fieldsFigure(state);
  }
  const pathCtrl = fieldsPathHandle(state, ctx.focus);
  if (pathCtrl) {
    return pathCtrl;
  }
  const posed = parseLabelHandle(ctx.focus);
  if (posed) {
    const arc = fieldsArcLabelPose(state, posed);
    if (arc) {
      return arc;
    }
    const obj = state.byId.get(posed);
    if (!obj || !state.points.has(posed)) {
      return [];
    }
    return pointCaption(state, obj);
  }
  const annot = fieldsAnnot(state, ctx.focus);
  if (annot) {
    return annot;
  }
  const obj = state.byId.get(ctx.focus);
  if (!obj) {
    return [];
  }
  const derived = fieldsDerived(state, obj);
  if (derived) {
    return derived;
  }
  const curve = fieldsCurve(state, obj);
  if (curve) {
    return curve;
  }
  const allowed = ctx.handles ? new Set(ctx.handles) : null;
  const role = pointRole(state, obj.id, allowed);
  if (obj.def[0] === "point") {
    const pt = state.points.get(obj.id);
    if (!pt) {
      return [];
    }
    return [
      num("x", "X", pt.x, !role.free),
      num("y", "Y", pt.y, !role.free),
      ...pointCaption(state, obj),
    ];
  }
  if (obj.def[0] === "division") {
    const pt = state.points.get(obj.id);
    if (!pt) {
      return [];
    }
    return [
      num("x", "X", pt.x, true),
      num("y", "Y", pt.y, true),
      /* AP:PB = m:n. 0 은 점이 끝으로 붙는다. 패널 바닥은 step 과 같은 1. */
      num("m", "m", obj.def[3], false, 1, 1),
      num("n", "n", obj.def[4], false, 1, 1),
      choice("mode", "Mode", obj.def[5], [
        { value: "internal", label: "Internal" },
        { value: "external", label: "External" },
      ]),
      ...pointCaption(state, obj),
    ];
  }
  if (obj.def[0] === "intersect") {
    const pt = state.points.get(obj.id);
    return [
      ...(pt
        ? [num("x", "X", pt.x, true), num("y", "Y", pt.y, true)]
        : []),
      text("pathA", "Path A", obj.def[1], true),
      text("pathB", "Path B", obj.def[2], true),
      num("index", "Index", obj.def[3], false, 1, 0),
      ...pointCaption(state, obj),
    ];
  }
  if (obj.def[0] === "projection") {
    const pt = state.points.get(obj.id);
    return [
      ...(pt
        ? [num("x", "X", pt.x, true), num("y", "Y", pt.y, true)]
        : []),
      text("p", "P", obj.def[1], true),
      text("a", "A", obj.def[2], true),
      text("b", "B", obj.def[3], true),
      ...pointCaption(state, obj),
    ];
  }
  if (obj.def[0] === "on_path") {
    return [
      num("t", "t", obj.def[2], !role.drag, 0.01),
      ...pointCaption(state, obj),
    ];
  }
  if (obj.def[0] === "segment" || obj.def[0] === "line") {
    return [
      text("from", "From", obj.def[1], true),
      text("to", "To", obj.def[2], true),
      text("label", "Label", obj.label ?? "", false),
      showField(state, obj.id),
    ];
  }
  return [];
}

function pointCaption(
  state: GeometryState,
  obj: GeometrySpec["objects"][number],
): InspectField[] {
  return [
    text("label", "Label", obj.label ?? "", false),
    {
      key: "labelAngle",
      label: "Angle",
      type: "number",
      value: obj.labelAngle ?? LABEL_ANGLE_DEFAULT,
      unit: "°",
      step: 1,
      min: 0,
      max: 360,
    },
    {
      key: "labelDistance",
      label: "Distance",
      type: "number",
      value: obj.labelDistance ?? LABEL_GAP_MM,
      unit: "mm",
      step: 0.1,
      min: 0,
    },
    markField(state, obj.id),
    showField(state, obj.id),
  ];
}

function num(
  key: string,
  label: string,
  value: number,
  disabled: boolean,
  step = 0.1,
  min?: number,
): InspectField {
  return { key, label, type: "number", value, step, min, disabled };
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
