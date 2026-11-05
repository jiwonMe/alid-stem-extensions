/**
 * DisplayList text 조판 상자.
 * 자리·히트는 이 크기를 쓴다. 조판할 수 없는 평문은 Unicode 폭으로 근사한다.
 * 교과를 모른다. 플러그인이 mm 로 받는다.
 */
import { latexToSvg, shouldTypeset, texSource } from "./latex.ts";

/** 조판 실패·한글. sans 평균. SEG_ARC_CHAR_EM 과 같음. */
const FALLBACK_EM = 0.58;
/* Unicode Script 속성으로 전각 CJK·한글을 구분한다. 특정 교과 문구나 폰트를 열거하지 않는다.
 * 정확한 폰트 메트릭은 아니지만 전각 문자를 라틴 평균 0.58em로 줄이는 오차를 막는다. */
const WIDE_CHARACTER = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff01-\uff60\uffe0-\uffe6]/u;
const COMBINING_MARK = /\p{Mark}/u;

/**
 * baseline (0,0) 기준 상자. y 위가 음수(페이지).
 * @param text DisplayItem.text
 * @param size_mm item.size. latexToSvg fontPx 에 그대로 넣어 mm 를 얻는다
 * @returns 왼쪽·위가 기준점. 빈 문자열은 0
 */
export function measureLabelMm(
  text: string,
  size_mm: number,
): { x: number; y: number; w: number; h: number } {
  if (text.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  if (shouldTypeset(text)) {
    const built = latexToSvg(texSource(text), size_mm, "#000000");
    if (built) {
      return {
        x: 0,
        /* latexGroup top = baseline - height - valign */
        y: -(built.height + built.valign),
        w: built.width,
        h: built.height,
      };
    }
  }
  /* NFC는 분리된 현대 한글 자모를 한 음절로 합친다. 결합 부호는 별도 폭을 차지하지 않는다. */
  const em = Array.from(text.normalize("NFC")).reduce((width, character) =>
    width + (COMBINING_MARK.test(character) ? 0 : WIDE_CHARACTER.test(character) ? 1 : FALLBACK_EM), 0);
  const w = Math.max(em * size_mm, size_mm * 0.5);
  return { x: 0, y: -size_mm, w, h: size_mm };
}
