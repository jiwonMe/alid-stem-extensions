/**
 * 조판 SVG → 페이지에 넣을 g.
 * 중첩 <svg viewBox> 를 남기면 svgkit 이 그 원점을 문서 원점으로 쓴다.
 * 카메라는 페이지 viewBox 만 본다. 여기 좌표는 글리프 로컬이다.
 */
import { latexPaths } from "./latex-paths.ts";
import { parseSvgViewBox } from "./svg-viewbox.ts";

/**
 * width/height 픽셀 상자에 맞춘 path 그룹.
 * viewBox 원점은 여기서 뺀다. 호출 측은 translate(x, top) 만.
 * @param svg latexToSvg().svg
 * @param width 이미 스케일한 CSS px
 * @param height 이미 스케일한 CSS px
 * @param fill #rrggbb. 조판 fill 을 다시 박는다
 * @returns path 없거나 viewBox 깨지면 undefined. 그때는 중첩 svg 를 쓰지 말 것
 */
export function flattenLatexSvg(
  svg: string,
  width: number,
  height: number,
  fill: string,
): string | undefined {
  const vb = parseSvgViewBox(svg);
  const paths = latexPaths(svg);
  if (!vb || paths.length === 0) {
    return undefined;
  }
  const sx = width / vb.w;
  const sy = height / vb.h;
  const body = paths
    .map((path) => {
      const [a, b, c, d, e, f] = path.matrix;
      return (
        `<path d="${esc(path.d)}"` +
        ` transform="matrix(${a} ${b} ${c} ${d} ${e} ${f})"` +
        ` fill="${esc(fill)}"/>`
      );
    })
    .join("");
  return (
    `<g transform="scale(${sx} ${sy}) translate(${-vb.x} ${-vb.y})">` +
    `${body}</g>`
  );
}

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
