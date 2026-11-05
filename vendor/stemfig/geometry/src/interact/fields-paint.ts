/**
 * 객체 스타일의 속성 행. 앱은 필드 종류만 렌더하고 이 키의 뜻은 모른다.
 * 라벨·경로 제어점 선택은 소유 객체에 적용하며 채움은 닫힌 도형에만 연다.
 */
import { DEFAULT_STYLE, type ResolvedStyle } from "@stemfig/display";
import type { FieldPatch, InspectField } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { parseLabelHandle } from "../label-handle.ts";
import { parsePathHandle } from "../path-handle.ts";
import type { ObjectPaint } from "../paint.ts";
import { ANGLE_MARK_WIDTH_MM } from "../mark-geom.ts";
import { SEG_ARC_WIDTH_MM } from "../seg-label-arc.ts";
import { isPointDef } from "../schema.ts";

const PAINT_KEYS = new Set(["stroke", "strokeWidth", "lineStyle", "fill", "fillEnabled", "labelSize"]);

/** @param id 선택 손잡이 @returns 객체 스타일 행. 소유 객체가 없으면 빈 배열 */
export function fieldsPaint(state: GeometryState, id: string, base: ResolvedStyle = DEFAULT_STYLE): InspectField[] {
  const owner = ownerId(id);
  const obj = state.byId.get(owner);
  const angle = state.spec.angles?.find((item) => item.id === owner);
  const mark = state.spec.marks?.find((item) => item.id === owner);
  const paint = obj ?? angle ?? mark;
  if (!paint) return [];
  const labelOnly = !!parseLabelHandle(id);
  const defaultWidth = angle ? ANGLE_MARK_WIDTH_MM : mark?.style === "arc" ? SEG_ARC_WIDTH_MM : base.width;
  const defaultLine = mark?.style === "arc" ? "dashed" : "solid";
  const rows: InspectField[] = [{ key: "stroke", label: "Color", type: "color", value: paint.stroke ?? base.stroke }];
  if (!labelOnly) {
    rows.push({ key: "strokeWidth", label: "Stroke", type: "number", value: paint.strokeWidth ?? defaultWidth, unit: "mm", step: 0.05, min: 0.05 });
    if (!obj || !isPointDef(obj.def[0])) rows.push({ key: "lineStyle", label: "Line", type: "enum", value: paint.lineStyle ?? defaultLine, options: [{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }] });
    if (obj && ["polygon", "circle", "circumcircle", "incircle"].includes(obj.def[0])) {
      rows.push({ key: "fillEnabled", label: "Fill", type: "boolean", value: !!paint.fill });
      if (paint.fill) rows.push({ key: "fill", label: "Fill color", type: "color", value: paint.fill });
    }
  }
  if (!obj || isPointDef(obj.def[0])) rows.push({ key: "labelSize", label: "Label size", type: "number", value: paint.labelSize ?? base.textSize, unit: "mm", step: 0.1, min: 0.1 });
  return rows;
}

/** @param patch 필드 입력 @returns 해당 스타일이면 새 상태. 다른 키면 undefined */
export function applyPaint(state: GeometryState, patch: FieldPatch): GeometryState | undefined {
  if (!PAINT_KEYS.has(patch.key)) return undefined;
  const id = ownerId(patch.id);
  const update = <T extends ObjectPaint & { id: string }>(item: T): T => {
    if (item.id !== id) return item;
    if (patch.key === "fillEnabled") {
      /* 채움 활성화 시 중립 회색을 쓴다. 본문 잉크와 독립적인 초기 채움값이다. */
      if (patch.value === true) return { ...item, fill: item.fill ?? "#e5e7eb" };
      const { fill: _fill, ...rest } = item;
      return rest as T;
    }
    if (["strokeWidth", "labelSize"].includes(patch.key) && (typeof patch.value !== "number" || !Number.isFinite(patch.value) || patch.value <= 0)) return item;
    if (["stroke", "fill"].includes(patch.key) && (typeof patch.value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(patch.value))) return item;
    if (patch.key === "lineStyle" && patch.value !== "solid" && patch.value !== "dashed") return item;
    return { ...item, [patch.key]: patch.value };
  };
  return initGeometry({ ...state.spec, objects: state.spec.objects.map(update),
    ...(state.spec.angles ? { angles: state.spec.angles.map(update) } : {}),
    ...(state.spec.marks ? { marks: state.spec.marks.map(update) } : {}),
  });
}

function ownerId(id: string): string { return parseLabelHandle(id) ?? parsePathHandle(id)?.id ?? id; }
