/**
 * SVG path d → 닫힌 점열.
 * 곡선은 샘플한다. clip 이 path 를 자를 때만 쓴다.
 * 교과·조판을 모른다. A/a 호는 끝점만.
 */

export type PolyRing = [number, number][];

/**
 * 3차·2차 한 칸 샘플. 1.6mm 글자에서 각이 안 보이게.
 * DisplayList 폭발 전에 멈춘 값.
 */
export const CURVE_STEPS = 8;

/**
 * 서브패스마다 링 하나. Z 가 없으면 연 채로 둔다.
 * @param d path d. MathJax 가 주는 것
 * @returns 점 2개 미만 링은 뺀다
 */
export function pathRings(d: string): PolyRing[] {
  const tokens = tokenize(d);
  const rings: PolyRing[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let px = 0;
  let py = 0;
  let cmd = "";
  let ring: PolyRing = [];

  const flush = () => {
    if (ring.length >= 2) {
      rings.push(ring);
    }
    ring = [];
  };

  while (i < tokens.length) {
    const tok = tokens[i]!;
    if (isCmd(tok)) {
      cmd = tok;
      i += 1;
    } else if (!cmd) {
      i += 1;
      continue;
    }
    if (cmd === "Z" || cmd === "z") {
      if (ring.length > 0) {
        ring.push([sx, sy]);
      }
      flush();
      cx = sx;
      cy = sy;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const kind = cmd.toUpperCase();
    if (kind === "M") {
      flush();
      const p = readPt(tokens, i, cx, cy, rel);
      i += 2;
      cx = p[0];
      cy = p[1];
      sx = cx;
      sy = cy;
      px = cx;
      py = cy;
      ring = [p];
      cmd = rel ? "l" : "L";
      continue;
    }
    if (kind === "L") {
      const p = readPt(tokens, i, cx, cy, rel);
      i += 2;
      cx = p[0];
      cy = p[1];
      px = cx;
      py = cy;
      ring.push(p);
      continue;
    }
    if (kind === "H") {
      const x = readNum(tokens, i, cx, rel);
      i += 1;
      cx = x;
      px = cx;
      py = cy;
      ring.push([cx, cy]);
      continue;
    }
    if (kind === "V") {
      const y = readNum(tokens, i, cy, rel);
      i += 1;
      cy = y;
      px = cx;
      py = cy;
      ring.push([cx, cy]);
      continue;
    }
    if (kind === "C") {
      const c1 = readPt(tokens, i, cx, cy, rel);
      const c2 = readPt(tokens, i + 2, cx, cy, rel);
      const p = readPt(tokens, i + 4, cx, cy, rel);
      i += 6;
      pushCubic(ring, cx, cy, c1, c2, p);
      px = c2[0];
      py = c2[1];
      cx = p[0];
      cy = p[1];
      continue;
    }
    if (kind === "S") {
      const c1: [number, number] = [2 * cx - px, 2 * cy - py];
      const c2 = readPt(tokens, i, cx, cy, rel);
      const p = readPt(tokens, i + 2, cx, cy, rel);
      i += 4;
      pushCubic(ring, cx, cy, c1, c2, p);
      px = c2[0];
      py = c2[1];
      cx = p[0];
      cy = p[1];
      continue;
    }
    if (kind === "Q") {
      const c1 = readPt(tokens, i, cx, cy, rel);
      const p = readPt(tokens, i + 2, cx, cy, rel);
      i += 4;
      pushQuad(ring, cx, cy, c1, p);
      px = c1[0];
      py = c1[1];
      cx = p[0];
      cy = p[1];
      continue;
    }
    if (kind === "T") {
      const c1: [number, number] = [2 * cx - px, 2 * cy - py];
      const p = readPt(tokens, i, cx, cy, rel);
      i += 2;
      pushQuad(ring, cx, cy, c1, p);
      px = c1[0];
      py = c1[1];
      cx = p[0];
      cy = p[1];
      continue;
    }
    if (kind === "A") {
      i += 5;
      const p = readPt(tokens, i, cx, cy, rel);
      i += 2;
      cx = p[0];
      cy = p[1];
      ring.push(p);
      continue;
    }
    i += 1;
  }
  flush();
  return rings;
}

function tokenize(d: string): string[] {
  const out: string[] = [];
  const re =
    /[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
  for (const hit of d.matchAll(re)) {
    out.push(hit[0]);
  }
  return out;
}

function isCmd(tok: string): boolean {
  return /^[MmLlHhVvCcSsQqTtAaZz]$/.test(tok);
}

function readNum(
  tokens: string[],
  i: number,
  cur: number,
  rel: boolean,
): number {
  const n = Number(tokens[i] ?? 0);
  return rel ? cur + n : n;
}

function readPt(
  tokens: string[],
  i: number,
  cx: number,
  cy: number,
  rel: boolean,
): [number, number] {
  const x = Number(tokens[i] ?? 0);
  const y = Number(tokens[i + 1] ?? 0);
  return rel ? [cx + x, cy + y] : [x, y];
}

function pushCubic(
  ring: PolyRing,
  x0: number,
  y0: number,
  c1: [number, number],
  c2: [number, number],
  p: [number, number],
): void {
  for (let s = 1; s <= CURVE_STEPS; s += 1) {
    const t = s / CURVE_STEPS;
    ring.push(cubic(x0, y0, c1, c2, p, t));
  }
}

function pushQuad(
  ring: PolyRing,
  x0: number,
  y0: number,
  c1: [number, number],
  p: [number, number],
): void {
  for (let s = 1; s <= CURVE_STEPS; s += 1) {
    const t = s / CURVE_STEPS;
    ring.push(quad(x0, y0, c1, p, t));
  }
}

function cubic(
  x0: number,
  y0: number,
  c1: [number, number],
  c2: [number, number],
  p: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * x0 + b * c1[0] + c * c2[0] + d * p[0],
    a * y0 + b * c1[1] + c * c2[1] + d * p[1],
  ];
}

function quad(
  x0: number,
  y0: number,
  c1: [number, number],
  p: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * x0 + 2 * u * t * c1[0] + t * t * p[0],
    u * u * y0 + 2 * u * t * c1[1] + t * t * p[1],
  ];
}
