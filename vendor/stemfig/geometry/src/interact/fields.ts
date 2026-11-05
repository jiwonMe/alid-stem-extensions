/**
 * 속성 패널의 단일 읽기·쓰기 진입점.
 * 호스트는 key 뜻을 모르며 스타일과 작도별 변환은 이 플러그인 안으로만 위임한다.
 */
import type { ApplyCtx, FieldsCtx, FieldPatch, InspectField } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { applyAnnotField } from "./fields-annot.ts";
import { applyCurveField } from "./fields-curve.ts";
import { applyDerivedField } from "./fields-derived.ts";
import { parseLabelHandle } from "../label-handle.ts";
import { applyFigureField } from "./fields-figure.ts";
import { applyMark } from "./fields-mark.ts";
import { applyPaint, fieldsPaint } from "./fields-paint.ts";
import { validateFieldGeometry } from "./validate-field.ts";
import { applyShow } from "./fields-show.ts";
import { pointRole } from "./free.ts";
import { applyPathHandleField } from "./path-ctrl.ts";
import { baseFieldsGeometry } from "./fields-read.ts";
import { applyDivisionField, applyIntersectField, setPoint, setOnPathT, setLabelAngle, setLabelDistance, setLabel } from "./fields-point-write.ts";

/* A:label 은 라벨 위치·표시만 받는다. 좌표 패치로 본체 점을 옮기지 않는다. */
const LABEL_POSE_KEYS = new Set(["label", "labelAngle", "labelDistance", "distance", "side", "show", "mark"]);

/** @param ctx 선택 손잡이 @param state 현재 작도 @returns 객체 속성과 스타일 행 */
export function fieldsGeometry(ctx: FieldsCtx, state: GeometryState): readonly InspectField[] {
  return [...baseFieldsGeometry(ctx, state), ...(ctx.focus ? fieldsPaint(state, ctx.focus, ctx.style) : [])];
}

/** @param patch 필드 절대값 @returns 새 상태. 잠긴 좌표·유효하지 않은 값·모르는 키는 입력 */
export function applyFieldGeometry(
  _ctx: ApplyCtx,
  state: GeometryState,
  patch: FieldPatch,
): GeometryState {
  if (validateFieldGeometry(_ctx, state, patch)) return state;
  const paint = applyPaint(state, patch);
  if (paint) return paint;
  const figure = applyFigureField(state, patch);
  if (figure) {
    return figure;
  }
  const pathCtrl = applyPathHandleField(state, patch);
  if (pathCtrl) {
    return pathCtrl;
  }
  const posed = parseLabelHandle(patch.id);
  if (posed && !LABEL_POSE_KEYS.has(patch.key)) {
    return state;
  }
  const annot = applyAnnotField(state, posed ? { ...patch, id: posed } : patch);
  if (annot) {
    return annot;
  }
  const obj = state.byId.get(posed ?? patch.id);
  if (!obj) {
    return state;
  }
  const role = pointRole(state, obj.id, null);
  if (patch.key === "label" && typeof patch.value === "string") {
    return initGeometry(setLabel(state.spec, obj.id, patch.value));
  }
  if (patch.key === "labelAngle" && typeof patch.value === "number") {
    if (!state.points.has(obj.id)) {
      return state;
    }
    return initGeometry(setLabelAngle(state.spec, obj.id, patch.value));
  }
  if (patch.key === "labelDistance" && typeof patch.value === "number") {
    if (!state.points.has(obj.id)) {
      return state;
    }
    return initGeometry(setLabelDistance(state.spec, obj.id, patch.value));
  }
  if (patch.key === "show" && typeof patch.value === "boolean") {
    return applyShow(state, obj.id, obj.def[0], patch.value) ?? state;
  }
  if (patch.key === "mark" && typeof patch.value === "boolean") {
    return applyMark(state, obj.id, obj.def[0], patch.value) ?? state;
  }
  if (patch.key === "x" || patch.key === "y") {
    if (obj.def[0] !== "point" || !role.free || typeof patch.value !== "number") {
      return state;
    }
    const x = patch.key === "x" ? patch.value : obj.def[1];
    const y = patch.key === "y" ? patch.value : obj.def[2];
    return initGeometry(setPoint(state.spec, obj.id, x, y));
  }
  if (patch.key === "t") {
    if (obj.def[0] !== "on_path" || !role.drag || typeof patch.value !== "number") {
      return state;
    }
    return initGeometry(setOnPathT(state, obj.id, patch.value));
  }
  if (obj.def[0] === "division") {
    return applyDivisionField(state, obj.id, obj.def, patch);
  }
  if (obj.def[0] === "intersect") {
    return applyIntersectField(state, obj.id, obj.def, patch);
  }
  return (
    applyDerivedField(state, obj, patch) ??
    applyCurveField(state, obj, patch) ??
    state
  );
}
