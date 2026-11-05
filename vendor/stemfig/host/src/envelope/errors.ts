/**
 * 검증 실패의 공통 모양.
 * throw 는 StemfigValidationError 한 개. StemfigError[] 를 직접 throw 하지 말 것.
 * 봉투 실패만 compileDocument 가 throw. figure 실패는 오류 박스.
 */

export type StemfigErrorCode =
  | "SCHEMA"
  | "SPEC"
  | "MISSING_PLUGIN"
  | "UNKNOWN_REF"
  | "CYCLE"
  | "BAD_FN"
  | "BAD_CELL"
  | "EMPTY_SHOW";

/** path 예: nodes.0.children.1.spec.objects.3 */
export type StemfigError = {
  code: StemfigErrorCode;
  path: string;
  message: string;
  /**
   * 그 자리에 올 수 있는 값의 문법. zod 스키마에서 만든다 (check/zod-describe).
   * 없으면 메시지가 이미 충분하거나 스키마 자리를 못 찾은 것이다. message 에는 섞지 않는다.
   */
  expected?: string;
};

/** errors 를 필드로 들고, message 는 path: message 를 줄바꿈으로 이은 것. */
export class StemfigValidationError extends Error {
  readonly errors: StemfigError[];

  constructor(errors: StemfigError[]) {
    super(errors.map((item) => `${item.path}: ${item.message}`).join("\n"));
    this.name = "StemfigValidationError";
    this.errors = errors;
  }
}

/** 플러그인 init/compile 이 한 건만 던질 때 사용. */
export function stemfigError(
  code: StemfigErrorCode,
  path: string,
  message: string,
): StemfigValidationError {
  return new StemfigValidationError([{ code, path, message }]);
}
