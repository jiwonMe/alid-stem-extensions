/**
 * 진단 한 건의 모양. checkDocument 와 checkEnvelopeKeys 가 같은 모양을 낸다.
 * 키 순서를 diag 한 곳에서 고정한다. JSON 으로 내보내면 읽는 순서가 매번 같다.
 * kind 를 모른다. code 는 호스트 오류 코드와 아래 경고 코드뿐이다.
 */
import type { StemfigErrorCode } from "../envelope/errors.ts";

/**
 * 그려지지만 의도와 다를 수 있는 것.
 * IGNORED_KEY: 스키마가 모르는 키라 조용히 버려졌다 (오타가 흔한 원인).
 * CONTROL_CHAR: 문자열에 제어 문자가 있다. JSON 에 TeX 명령을 백슬래시 하나로 쓰면(\beta) 생긴다.
 * CLIPPED: figure 상자가 부모 시트 밖으로 나가 넘친 부분이 잘린다.
 * HIDDEN: figure 상자가 부모 시트와 겹치지 않아 아무것도 안 그려진다.
 */
export type StemfigWarningCode = "IGNORED_KEY" | "CONTROL_CHAR" | "CLIPPED" | "HIDDEN";

/**
 * 진단 한 건. path 는 문서 루트부터의 JSON 경로. 예: nodes.0.children.1.spec.objects.3.def
 * error 는 그 figure 가 오류 박스로 그려진다는 뜻이다. warning 은 그려진다.
 */
export type Diagnostic = {
  severity: "error" | "warning";
  code: StemfigErrorCode | StemfigWarningCode;
  path: string;
  message: string;
  /** 관련 figure id. 봉투 오류에는 없을 수 있다 */
  node?: string;
  /** 그 자리에 올 수 있는 값의 문법. 스키마에서 만든다 */
  expected?: string;
};

/**
 * @param node 관련 figure·노드 id. 없으면 키를 넣지 않는다
 * @param expected 문법 힌트. 없으면 키를 넣지 않는다
 */
export function diag(
  severity: Diagnostic["severity"],
  code: Diagnostic["code"],
  path: string,
  message: string,
  node?: string,
  expected?: string,
): Diagnostic {
  return {
    severity,
    code,
    path,
    message,
    ...(node !== undefined ? { node } : {}),
    ...(expected ? { expected } : {}),
  };
}
