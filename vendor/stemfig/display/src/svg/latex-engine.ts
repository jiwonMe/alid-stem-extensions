/**
 * 조판 엔진. 교과를 모른다. 기본은 upmath (i.upmath.me).
 * mathjax 는 문서.latex 가 명시할 때만. 네트워크는 hydrate 가 채운다.
 */

/** mathjax 는 동기. upmath 는 캐시가 있을 때만 동기. */
export type LatexEngine = "mathjax" | "upmath";

let engine: LatexEngine = "upmath";

/**
 * 봉투 키를 빼면 upmath. mathjax 만 명시한다.
 */
export function latexEngineFromDoc(
  latex: LatexEngine | undefined,
): LatexEngine {
  return latex === "mathjax" ? "mathjax" : "upmath";
}

/**
 * 현재 엔진. compile / render 가 같은 값을 보게 모듈 한곳.
 */
export function latexEngine(): LatexEngine {
  return engine;
}

/**
 * 문서.latex 를 compile 앞에 올린다.
 */
export function setLatexEngine(next: LatexEngine): void {
  engine = next;
}
