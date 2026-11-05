/**
 * MathJax SVG → path + 누적 transform.
 * 글자마다 translate 가 있다. d 만 모으면 자간 없이 겹친다.
 * 교과를 모른다. 브라우저 Path2D 는 호출 측.
 */

/**
 * Canvas / SVG matrix(a,b,c,d,e,f).
 * ctx.transform 과 같은 칸. 교과 좌표가 아니다.
 */
export type SvgMatrix = [number, number, number, number, number, number];

/**
 * viewBox 좌표의 한 글리프.
 * matrix 는 조상 g 와 path 자신의 transform 을 곱한 값.
 */
export type LatexPath = {
  d: string;
  matrix: SvgMatrix;
};

const IDENT: SvgMatrix = [1, 0, 0, 1, 0, 0];

/**
 * MathJax 가 준 SVG 문자열.
 * @param svg latexToSvg().svg
 * @returns path 없으면 빈 배열. 순서는 그리는 순
 */
export function latexPaths(svg: string): LatexPath[] {
  const out: LatexPath[] = [];
  const stack: SvgMatrix[] = [IDENT];
  const re = /<(\/?)(g|path)\b([^>]*)>/g;
  for (const match of svg.matchAll(re)) {
    const close = match[1] === "/";
    const tag = match[2];
    const attrs = match[3] ?? "";
    if (close) {
      if (tag === "g" && stack.length > 1) {
        stack.pop();
      }
      continue;
    }
    const local = parseTransform(attr(attrs, "transform"));
    const cur = mul(stack[stack.length - 1]!, local);
    if (tag === "g") {
      stack.push(cur);
      continue;
    }
    const d = attr(attrs, "d");
    if (d) {
      out.push({ d, matrix: cur });
    }
  }
  return out;
}

/**
 * A ∘ B. 점 p 는 A·(B·p).
 */
function mul(a: SvgMatrix, b: SvgMatrix): SvgMatrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/**
 * translate / scale / matrix 만. MathJax 가 쓰는 것.
 * 없으면 항등.
 */
function parseTransform(raw: string | undefined): SvgMatrix {
  if (!raw) {
    return IDENT;
  }
  let m: SvgMatrix = IDENT;
  const re = /(translate|scale|matrix)\(([^)]*)\)/g;
  for (const hit of raw.matchAll(re)) {
    const nums = hit[2]!.trim().split(/[\s,]+/).map(Number);
    if (hit[1] === "translate") {
      m = mul(m, [1, 0, 0, 1, nums[0] ?? 0, nums[1] ?? 0]);
      continue;
    }
    if (hit[1] === "scale") {
      const sx = nums[0] ?? 1;
      m = mul(m, [sx, 0, 0, nums[1] ?? sx, 0, 0]);
      continue;
    }
    if (nums.length === 6 && nums.every((n) => Number.isFinite(n))) {
      m = mul(m, nums as SvgMatrix);
    }
  }
  return m;
}

function attr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1];
}
