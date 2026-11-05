/**
 * 각·변 마크 패널. objects 가 아니다.
 * Count 는 number 가 아니라 Mark·Style 과 같은 enum (1 / 2 / 3).
 * 각 circle·변 circle·변 arc 는 Count 행을 올리지 않는다. 값은 1 고정.
 * 변 arc 만 Distance(mm)·Direction(left/right) 행을 올린다. 없으면 숨긴다.
 */
import type { FieldPatch, InspectField } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import type {
  AngleAnnot,
  EqualStyle,
  GeometrySpec,
  MarkStyle,
  SegMark,
} from "../schema.ts";
import {
  clampBowDistance,
  SEG_ARC_SAGITTA_MAX_MM,
  SEG_ARC_SAGITTA_MIN_MM,
  SEG_ARC_SAGITTA_MM,
  type BowSide,
} from "../seg-label-arc.ts";

/**
 * 호 라벨 손잡이 k:label. 변 거리·좌우. 각은 점 라벨만.
 * @param state init 결과
 * @param focus 벗긴 마크 id. 예: k
 * @returns 캡션 행. arc 가 아니면 undefined
 */
export function fieldsArcLabelPose(
  state: GeometryState,
  focus: string,
): readonly InspectField[] | undefined {
  const mark = state.spec.marks?.find((item) => item.id === focus);
  if (!mark || (mark.style ?? "tick") !== "arc") {
    return undefined;
  }
  return [
    text("label", "Label", mark.label ?? "", false),
    num("distance", "Distance", mark.distance ?? SEG_ARC_SAGITTA_MM, false),
    choice("side", "Direction", mark.side ?? "left", [
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ]),
  ];
}

/**
 * focus 가 각·마크면 행. 아니면 undefined (objects 로).
 * Count 는 enum. 앱은 SegmentedControl 만 그린다.
 * @param state init 결과
 * @param focus 손잡이 id. 각·마크가 아니면 undefined
 * @returns 패널 행. 없으면 objects 필드가 그린다
 */
export function fieldsAnnot(
  state: GeometryState,
  focus: string,
): readonly InspectField[] | undefined {
  const ang = state.spec.angles?.find((item) => item.id === focus);
  if (ang) {
    const ticksOn = ang.mark === "equal";
    const style = ang.style ?? "arc";
    const circle = style === "circle";
    const ticksMax = style === "dot" ? 2 : 3;
    const rows: InspectField[] = [
      choice("mark", "Mark", ang.mark, [
        { value: "none", label: "None" },
        { value: "right", label: "Right" },
        { value: "equal", label: "Equal" },
      ]),
      choice("style", "Style", style, [
        { value: "arc", label: "Arcs" },
        { value: "circle", label: "Circles" },
        { value: "dot", label: "Dots" },
      ], !ticksOn),
    ];
    if (ticksOn && !circle) {
      rows.push(
        choice(
          "ticks",
          "Count",
          String(ang.ticks ?? 1),
          countOpts(ticksMax),
        ),
      );
    }
    rows.push(text("label", "Label", ang.label ?? "", false));
    return rows;
  }
  const mark = state.spec.marks?.find((item) => item.id === focus);
  if (!mark) {
    return undefined;
  }
  const style = mark.style ?? "tick";
  const rows: InspectField[] = [
    choice("style", "Style", style, [
      { value: "tick", label: "Ticks" },
      { value: "circle", label: "Circles" },
      { value: "arc", label: "Arcs" },
    ]),
  ];
  if (!markCountLocked(style)) {
    rows.push(
      choice("ticks", "Count", String(mark.ticks), countOpts(3)),
    );
  }
  if (style === "arc") {
    rows.push(
      num("distance", "Distance", mark.distance ?? SEG_ARC_SAGITTA_MM, false),
      choice("side", "Direction", mark.side ?? "left", [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ]),
    );
  }
  rows.push(text("label", "Label", mark.label ?? "", false));
  return rows;
}

/**
 * @returns 새 상태. 대상이 아니면 undefined
 */
export function applyAnnotField(
  state: GeometryState,
  patch: FieldPatch,
): GeometryState | undefined {
  const ang = state.spec.angles?.find((item) => item.id === patch.id);
  if (ang) {
    return applyAngle(state, ang, patch);
  }
  const mark = state.spec.marks?.find((item) => item.id === patch.id);
  if (!mark) {
    return undefined;
  }
  return applyMark(state, mark, patch);
}

function applyAngle(
  state: GeometryState,
  ang: AngleAnnot,
  patch: FieldPatch,
): GeometryState {
  let next: AngleAnnot = { ...ang };
  if (patch.key === "mark") {
    if (patch.value !== "none" && patch.value !== "right" && patch.value !== "equal") {
      return state;
    }
    next = { ...next, mark: patch.value };
  } else if (patch.key === "style") {
    if (ang.mark !== "equal" || !isEqualStyle(patch.value)) {
      return state;
    }
    const ticks =
      patch.value === "circle"
        ? 1
        : patch.value === "dot"
          ? Math.min(ang.ticks ?? 1, 2)
          : ang.ticks;
    next = { ...next, style: patch.value, ticks };
  } else if (patch.key === "ticks") {
    if (ang.mark !== "equal" || (ang.style ?? "arc") === "circle") {
      return state;
    }
    const max = (ang.style ?? "arc") === "dot" ? 2 : 3;
    const ticks = parseCount(patch.value, max);
    if (ticks === undefined) {
      return state;
    }
    next = { ...next, ticks };
  } else if (patch.key === "label" && typeof patch.value === "string") {
    next = { ...next, label: patch.value === "" ? undefined : patch.value };
  } else {
    return state;
  }
  return initGeometry(setAngle(state.spec, next));
}

function applyMark(
  state: GeometryState,
  mark: SegMark,
  patch: FieldPatch,
): GeometryState {
  let next: SegMark = { ...mark };
  if (patch.key === "style") {
    if (!isMarkStyle(patch.value)) {
      return state;
    }
    next = {
      ...next,
      style: patch.value,
      ticks: markCountLocked(patch.value) ? 1 : mark.ticks,
    };
  } else if (patch.key === "ticks") {
    if (markCountLocked(mark.style ?? "tick")) {
      return state;
    }
    const ticks = parseCount(patch.value, 3);
    if (ticks === undefined) {
      return state;
    }
    next = { ...next, ticks };
  } else if (patch.key === "distance") {
    if (
      (mark.style ?? "tick") !== "arc" ||
      typeof patch.value !== "number" ||
      !Number.isFinite(patch.value)
    ) {
      return state;
    }
    next = { ...next, distance: clampBowDistance(patch.value) };
  } else if (patch.key === "side") {
    if ((mark.style ?? "tick") !== "arc" || !isBowSide(patch.value)) {
      return state;
    }
    next = { ...next, side: patch.value };
  } else if (patch.key === "label" && typeof patch.value === "string") {
    next = { ...next, label: patch.value === "" ? undefined : patch.value };
  } else {
    return state;
  }
  return initGeometry(setMark(state.spec, next));
}

function setAngle(spec: GeometrySpec, next: AngleAnnot): GeometrySpec {
  return {
    ...spec,
    angles: (spec.angles ?? []).map((item) =>
      item.id === next.id ? next : item,
    ),
  };
}

function setMark(spec: GeometrySpec, next: SegMark): GeometrySpec {
  return {
    ...spec,
    marks: (spec.marks ?? []).map((item) =>
      item.id === next.id ? next : item,
    ),
  };
}

function isEqualStyle(value: unknown): value is EqualStyle {
  return value === "arc" || value === "circle" || value === "dot";
}

function isMarkStyle(value: unknown): value is MarkStyle {
  return value === "tick" || value === "circle" || value === "arc";
}

function markCountLocked(style: string): boolean {
  return style === "circle" || style === "arc";
}

function isBowSide(value: unknown): value is BowSide {
  return value === "left" || value === "right";
}

/**
 * 패널 enum 은 문자열. 옛 테스트의 숫자도 받는다.
 * @returns 1..max. 아니면 undefined (문서 유지)
 */
function parseCount(value: unknown, max: number): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return undefined;
  }
  const ticks = Math.round(n);
  if (ticks < 1 || ticks > max) {
    return undefined;
  }
  return ticks;
}

function countOpts(max: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let i = 1; i <= max; i += 1) {
    const id = String(i);
    out.push({ value: id, label: id });
  }
  return out;
}

function num(
  key: string,
  label: string,
  value: number,
  disabled: boolean,
): InspectField {
  return {
    key,
    label,
    type: "number",
    value,
    unit: "mm",
    step: 0.2,
    min: SEG_ARC_SAGITTA_MIN_MM,
    max: SEG_ARC_SAGITTA_MAX_MM,
    disabled,
  };
}

function text(key: string, label: string, value: string, disabled: boolean): InspectField {
  return { key, label, type: "text", value, disabled };
}

function choice(
  key: string,
  label: string,
  value: string,
  options: { value: string; label: string }[],
  disabled = false,
): InspectField {
  return { key, label, type: "enum", value, options, disabled };
}
