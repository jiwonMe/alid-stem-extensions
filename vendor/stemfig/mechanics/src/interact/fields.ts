/**
 * 역학 속성 패널의 유일한 읽기·쓰기 경계.
 * 플러그인이 선언한 행만 수정 가능하며 schema와 참조 검증을 모두 통과해야 상태를 바꾼다.
 * 이 층은 Document·HistoryStore·렌더러를 모르고 새 MechanicsState만 반환한다.
 */
import type { ApplyCtx, FieldsCtx, FieldPatch, InspectField } from "@stemfig/host";
import { initMechanics, type MechanicsState } from "../init.ts";
import { mechanicsSpecSchema } from "../schema.ts";
import { fieldTarget, readMechanicsFields } from "./fields-read.ts";
import { writeMechanicsObject } from "./fields-write.ts";

/**
 * @param ctx 선택한 객체·손잡이와 봉투의 편집 허용 목록
 * @param state 현재 파생 상태
 * @returns 속성 행. 선택이 없거나 잘못된 손잡이는 빈 배열이며 예외를 던지지 않는다.
 */
export function fieldsMechanics(ctx: FieldsCtx, state: MechanicsState): readonly InspectField[] {
  const target = ctx.focus && fieldTarget(state, ctx.focus);
  if (!target) return [];
  const fields = readMechanicsFields(state, target);
  const allowed = !ctx.handles || ctx.handles.includes(target.object.id) || ctx.handles.includes(ctx.focus!);
  return allowed ? fields : fields.map(field => ({ ...field, disabled: true }));
}

/**
 * @param _ctx 호스트 공통 편집 문맥. 장면 좌표를 입력하므로 페이지 변환은 필요 없다.
 * @param state 변경 전 상태
 * @param patch 절대값 속성 패치
 * @returns 검증한 새 상태. 잘못된 값·참조·미지원 키는 원본이며 예외를 던지지 않는다.
 */
export function applyFieldMechanics(_ctx: ApplyCtx, state: MechanicsState, patch: FieldPatch): MechanicsState {
  return evaluate(state, patch).state ?? state;
}

/**
 * @param _ctx 호스트 공통 편집 문맥
 * @param state 변경 전 상태
 * @param patch 검증할 절대값 패치
 * @returns 실패 이유. 유효한 값 또는 미지원 대상·키는 undefined이며 예외를 던지지 않는다.
 */
export function validateFieldMechanics(_ctx: ApplyCtx, state: MechanicsState, patch: FieldPatch): string | undefined {
  return evaluate(state, patch).error;
}

function evaluate(state: MechanicsState, patch: FieldPatch): { state?: MechanicsState; error?: string } {
  const target = fieldTarget(state, patch.id);
  if (!target) return {};
  const field = readMechanicsFields(state, target).find(candidate => candidate.key === patch.key);
  if (!field || field.disabled) return {};
  const error = checkValue(field, patch.value);
  if (error) return { error };
  /* 같은 선택값을 재전송해도 연결 간격이나 기존 자세를 초기화하지 않는다. */
  if (field.value === patch.value) return {};
  const object = writeMechanicsObject(state, target, patch);
  if (object === target.object) return {};
  const parsed = mechanicsSpecSchema.safeParse({ ...state.spec, objects: state.spec.objects.map(o => o.id === object.id ? object : o) });
  if (!parsed.success) return { error: "작도 값을 확인하세요. 크기는 0보다 커야 하며 좌표는 유한해야 합니다." };
  try {
    return { state: initMechanics(parsed.data) };
  } catch (cause) {
    /* 유효한 JSON이라도 경로 붕괴나 누락된 연결은 기존 문서를 유지해야 한다. */
    return { error: cause instanceof Error ? `작도 입력 오류: ${cause.message}` : "작도 연결을 확인하세요." };
  }
}

function checkValue(field: InspectField, value: FieldPatch["value"]): string | undefined {
  if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "유한한 숫자를 입력하세요.";
    if (field.key === "coils" && !Number.isInteger(value)) return "용수철 감김 수는 정수로 입력하세요.";
    if (field.min !== undefined && value < field.min) return `${field.min} 이상의 값을 입력하세요.`;
    if (field.max !== undefined && value > field.max) return `${field.max} 이하의 값을 입력하세요.`;
  } else if (field.type === "boolean") {
    if (typeof value !== "boolean") return "참 또는 거짓을 선택하세요.";
  } else {
    if (typeof value !== "string") return "문자열을 입력하세요.";
    if (field.type === "enum" && !field.options.some(option => option.value === value)) return "목록에 있는 값을 선택하세요.";
  }
  return undefined;
}
