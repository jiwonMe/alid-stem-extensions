/**
 * 조판 결과. MathJax·upmath 가 같은 칸을 채운다.
 * 크기는 latexToSvg 호출 단위 (보통 mm 또는 px).
 */
export type LatexSvg = {
  svg: string;
  width: number;
  height: number;
  valign: number;
};
