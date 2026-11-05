/**
 * SVG viewBox 숫자 4개.
 * 조판·페이지 어느 쪽인지는 모른다. 파싱만 한다.
 */

export type SvgViewBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * `viewBox="x y w h"`. 쉼표 구분도 받는다.
 * @returns 폭·높이가 0 이하면 undefined
 */
export function parseSvgViewBox(svg: string): SvgViewBox | undefined {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (!match?.[1]) {
    return undefined;
  }
  const [x, y, w, h] = match[1].split(/[\s,]+/).map(Number);
  if (
    !(x === x) ||
    !(y === y) ||
    !(w === w && w > 0) ||
    !(h === h && h > 0)
  ) {
    return undefined;
  }
  return { x, y, w, h };
}
