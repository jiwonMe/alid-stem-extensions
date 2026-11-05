/**
 * 필드 오류 이유. applyField 의 무변경 실패를 UI 가 성공으로 오해하지 않게 한다.
 * 수식·경로 문법은 기존 파서를 재사용하며 호스트에는 문장만 돌려준다.
 */
import type { ApplyCtx, FieldPatch } from "@stemfig/host";
import type { GeometryState } from "../init.ts";
import { parseEquation } from "../math/equation.ts";
import { parseD } from "../math/svg-path.ts";
import { parseLabelHandle } from "../label-handle.ts";
import { parsePathHandle } from "../path-handle.ts";

/** @param patch 아직 적용하지 않은 값 @returns 오류 이유. 유효하거나 모르는 필드는 undefined */
export function validateFieldGeometry(_ctx: ApplyCtx, state: GeometryState, patch: FieldPatch): string | undefined {
  if (typeof patch.value === "number" && !Number.isFinite(patch.value)) return "유한한 숫자를 입력하세요.";
  if (["strokeWidth", "labelSize"].includes(patch.key) && (typeof patch.value !== "number" || patch.value <= 0)) return "0보다 큰 크기를 입력하세요.";
  /* SVG/색상 입력과 같은 6자리 RGB 만 허용한다. CSS 구문은 spec 에 저장하지 않는다. */
  if (["stroke", "fill"].includes(patch.key) && (typeof patch.value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(patch.value))) return "색상은 #RRGGBB 형식으로 입력하세요.";
  const id = parseLabelHandle(patch.id) ?? parsePathHandle(patch.id)?.id ?? patch.id;
  const obj = state.byId.get(id);
  if (!obj) return undefined;
  if (obj.def[0] === "division") {
    const m = patch.key === "m" ? patch.value : obj.def[3];
    const n = patch.key === "n" ? patch.value : obj.def[4];
    const mode = patch.key === "mode" ? patch.value : obj.def[5];
    if (typeof m === "number" && typeof n === "number" && (m <= 0 || n <= 0)) return "분할 비율은 0보다 커야 합니다.";
    if (mode === "external" && m === n) return "외분점은 두 비율이 같으면 정의되지 않습니다.";
  }
  if (obj.def[0] === "graph" && obj.def.length === 4) {
    const x0 = patch.key === "x0" ? patch.value : obj.def[2];
    const x1 = patch.key === "x1" ? patch.value : obj.def[3];
    if (x0 === x1) return "정의역의 시작과 끝은 달라야 합니다.";
  }
  try {
    if (patch.key === "eq" && obj.def[0] === "graph") {
      if (typeof patch.value !== "string") return "수식을 입력하세요.";
      parseEquation(patch.value, "eq");
    }
    if (patch.key === "d" && obj.def[0] === "path") {
      if (typeof patch.value !== "string") return "SVG 경로를 입력하세요.";
      parseD(patch.value, "d");
    }
  } catch (error) {
    return `입력 오류: ${error instanceof Error ? error.message : "문법을 확인하세요."}`;
  }
  return undefined;
}
