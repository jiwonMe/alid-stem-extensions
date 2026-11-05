/**
 * 사람이나 LLM 이 문서를 손으로 쓸 때 보는 문법. 봉투와 kind 별 spec.
 * 호스트는 spec 의 뜻을 모른다. 플러그인이 등록한 specSchema 를 글자로 옮길 뿐이다.
 * 필드 설명은 없다. 예시는 플러그인 fixture 가 맡는다.
 */
import { documentSchema } from "../envelope/document.ts";
import type { StemfigPlugin } from "../plugin/plugin.ts";
import { describeSchema } from "./zod-describe.ts";

/**
 * @returns stemfig/v1 봉투. figure.spec 은 unknown 으로 나온다. kind 별 문법은 specGrammar
 */
export function envelopeGrammar(): string {
  return describeSchema(documentSchema);
}

/**
 * @param plugin 레지스트리에 등록된 엔진
 * @returns 그 엔진의 figure.spec 문법. refine 규칙(참조 순서 등)은 담기지 않는다
 */
export function specGrammar(plugin: StemfigPlugin): string {
  return describeSchema(plugin.specSchema);
}
