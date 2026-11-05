/**
 * 해상 불가 덩어리의 열(px) 봉투. GeoDef 를 모른다.
 * 어느 구간이 덩어리인지는 explicit-region 이 정한다. 여기서는 모양만.
 * 한 사각형이 아니라 열마다 min/max 를 재서 x·sin(1/x) 같은 감쇠 진동이 쐐기로 보인다.
 * DisplayList 는 polygon 하나. 세로 막대 여러 개를 만들지 않는다.
 */
import type { PathPoint, ViewBox, XSpan } from "../path.ts";
import { RES, type ScreenMap } from "./explicit-screen.ts";

/**
 * 열 수 상한. 전폭 진동(sin(1000x))도 이 안에서 끝낸다.
 * 이보다 넓은 띠(시트 512mm 초과)는 열이 1px 보다 넓어져 봉투가 조금 거칠어질 뿐, 깨지지 않는다.
 * 열 하나가 최대 8+2·10 평가라 전폭이어도 ≈ 6 만 평가로 끝난다.
 */
const MAX_COLUMNS = 2048;

/**
 * 열 하나의 균등 표본 칸 수(점은 +1). 표본은 극값을 감싸는 괄호만 찾는다.
 * 표본값을 그대로 쓰면 봉우리 사이에 떨어져 열마다 최대가 몇 % 씩 다르고,
 * 확대하면 띠 위·아래가 계단으로 깨진다. 그래서 괄호 안을 황금분할로 조인다.
 */
const PROBES = 8;
const GOLDEN = 0.618033988749895;

/** 황금분할 반복. 괄호 2/8 px 가 0.618^10 ≈ 0.8% 로 준다. 위상 오차 ≈ 0. */
const REFINE_STEPS = 10;

/** 열 하나의 봉투. lo ≤ hi, 박스 안으로 잘려 있다. */
export type BandColumn = { x0: number; x1: number; lo: number; hi: number };

/**
 * 해상 불가 띠. x0..x1 은 독립축 덩어리, y0..y1 은 종속값 AABB.
 * along=y 면 독립이 y 라 열은 가로 줄. columns 는 독립축 오름차순.
 * 그리기·히트는 columns, 빠른 거절은 AABB(축에 맞게 해석).
 */
export type ExplicitBand = {
  along?: "x" | "y";
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  columns: BandColumn[];
};

/**
 * 덩어리 → 열 봉투. 열마다 min/max 를 재고 screen.box 로 자른다.
 * 열 폭은 RES.columnPx, 최소 두께는 RES.strokePx — 진폭이 0 으로 꺼지는 쐐기 끝이 채우기에서 사라지지 않게.
 * @param screen 열 폭을 px 로 재기 위해. 같은 pxPerUnit 이면 열 경계도 같다
 * @returns 박스 안에 든 열이 둘 미만이면 undefined (고립 극). 호출 측이 곡선으로 되돌린다
 */
export function envelopeOf(
  y: (x: number) => number,
  span: XSpan,
  screen: ScreenMap,
): ExplicitBand | undefined {
  const w = span.x1 - span.x0;
  if (!(w > 0)) {
    return undefined;
  }
  const widthPx = w * screen.pxPerUnitX;
  /* 1px 미만 띠도 열 둘로 나눠 폴리곤이 되게 한다. */
  const count = Math.max(2, Math.min(MAX_COLUMNS, Math.ceil(widthPx / RES.columnPx)));
  const dx = w / count;
  const minThick = RES.strokePx / screen.pxPerUnitY;
  const probed: Probed[] = [];
  for (let c = 0; c < count; c += 1) {
    const x0 = span.x0 + dx * c;
    const col = probeColumn(y, x0, x0 + dx, screen.box, minThick);
    if (col) {
      probed.push(col);
    }
  }
  if (probed.length < 2) {
    return undefined;
  }
  const columns = smoothEnvelope(probed);
  let y0 = Number.POSITIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const col of columns) {
    y0 = Math.min(y0, col.lo);
    y1 = Math.max(y1, col.hi);
  }
  if (!(y1 > y0)) {
    return undefined;
  }
  return { x0: span.x0, x1: span.x1, y0, y1, columns };
}

/** 열 + 극값이 열 안에서 정확히 잡혔는지. 잡힌 값은 봉투의 고정점이다. */
type Probed = BandColumn & { hiExact: boolean; loExact: boolean };

/**
 * 봉우리가 열 밖인 열은 양옆의 정확한 봉우리를 x 로 선형 보간한다.
 * 상수 진폭이면 평평, 감쇠 쐐기면 직선이 된다.
 * 이웃 max 로 팽창하면 주기 4~6px 구간에 선반 모양 계단이 생기고 쐐기 끝이 뭉개진다.
 * 보간값이 열의 표본값보다 안쪽이면 표본값을 지킨다 — 곡선이 띠 밖으로 나가면 안 된다.
 */
function smoothEnvelope(probed: Probed[]): BandColumn[] {
  const hi = interpolateExact(probed, "hi");
  const lo = interpolateExact(probed, "lo");
  return probed.map((col, i) => ({
    x0: col.x0,
    x1: col.x1,
    lo: Math.min(col.lo, lo[i]!),
    hi: Math.max(col.hi, hi[i]!),
  }));
}

function interpolateExact(probed: Probed[], key: "hi" | "lo"): number[] {
  const exactKey = key === "hi" ? "hiExact" : "loExact";
  const anchors = probed.map((c, i) => (c[exactKey] ? i : -1)).filter((i) => i >= 0);
  if (anchors.length === 0) {
    return probed.map((c) => c[key]);
  }
  const mid = (c: BandColumn) => (c.x0 + c.x1) / 2;
  let j = 0;
  return probed.map((col, i) => {
    while (j < anchors.length && anchors[j]! < i) {
      j += 1;
    }
    const right = anchors[j];
    const left = j > 0 ? anchors[j - 1] : undefined;
    if (right === i) {
      return col[key];
    }
    if (left === undefined) {
      return probed[right!]![key];
    }
    if (right === undefined) {
      return probed[left]![key];
    }
    const a = probed[left]!;
    const b = probed[right]!;
    const t = (mid(col) - mid(a)) / (mid(b) - mid(a));
    return a[key] + (b[key] - a[key]) * t;
  });
}

/**
 * 한 열의 min/max. 균등 표본으로 극값 괄호를 잡고 황금분할로 조인다.
 * 유한값이 없으면 열을 버린다. 박스 밖으로만 나가는 열(극 근처)은 경계에 붙은 0 두께가 된다.
 */
function probeColumn(
  y: (x: number) => number,
  x0: number,
  x1: number,
  box: ViewBox,
  minThick: number,
): Probed | undefined {
  const w = x1 - x0;
  const g = (t: number) => y(x0 + w * t);
  const vs: number[] = [];
  let iHi = -1;
  let iLo = -1;
  for (let i = 0; i <= PROBES; i += 1) {
    const v = g(i / PROBES);
    vs.push(v);
    if (!Number.isFinite(v)) {
      continue;
    }
    if (iHi < 0 || v > vs[iHi]!) {
      iHi = i;
    }
    if (iLo < 0 || v < vs[iLo]!) {
      iLo = i;
    }
  }
  if (iHi < 0) {
    return undefined;
  }
  const hiExact = iHi > 0 && iHi < PROBES;
  const loExact = iLo > 0 && iLo < PROBES;
  let hi = refineExtremum(g, vs, iHi, 1);
  let lo = refineExtremum(g, vs, iLo, -1);
  if (hi < box.ymin || lo > box.ymax) {
    return undefined;
  }
  if (hi - lo < minThick) {
    const mid = (hi + lo) / 2;
    lo = mid - minThick / 2;
    hi = mid + minThick / 2;
  }
  return {
    x0,
    x1,
    lo: Math.max(box.ymin, lo),
    hi: Math.min(box.ymax, hi),
    hiExact,
    loExact,
  };
}

/**
 * 표본 i 가 안쪽이면 [i-1, i+1] 괄호에서 황금분할로 극값을 조인다.
 * 끝점이면 봉우리가 열 밖이라 표본값 그대로(Exact 아님). 그 열은 smoothEnvelope 가 이웃 고정점으로 보간한다.
 * 괄호에 주기가 여럿 들어도(원점 근처) 어느 국소 극값으로든 수렴하며, sin 의 국소 극값은 전부 ±1 이다.
 * @param sign 1 이면 최대, -1 이면 최소
 */
function refineExtremum(
  g: (t: number) => number,
  vs: number[],
  i: number,
  sign: 1 | -1,
): number {
  let best = vs[i]!;
  if (i <= 0 || i >= vs.length - 1) {
    return best;
  }
  const score = (v: number) => (Number.isFinite(v) ? v * sign : Number.NEGATIVE_INFINITY);
  const take = (v: number) => {
    if (score(v) > score(best)) {
      best = v;
    }
  };
  let a = (i - 1) / PROBES;
  let b = (i + 1) / PROBES;
  let c = b - GOLDEN * (b - a);
  let d = a + GOLDEN * (b - a);
  let fc = g(c);
  let fd = g(d);
  take(fc);
  take(fd);
  for (let k = 0; k < REFINE_STEPS; k += 1) {
    if (score(fc) > score(fd)) {
      b = d;
      d = c;
      fd = fc;
      c = b - GOLDEN * (b - a);
      fc = g(c);
      take(fc);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + GOLDEN * (b - a);
      fd = g(d);
      take(fd);
    }
  }
  return best;
}

/**
 * polygon 외곽선. 위쪽 hi 를 왼→오, 아래쪽 lo 를 오→왼, 닫는다.
 * 열 중앙을 잇고 양 끝만 열 경계에 둔다. 1px 열이라 계단은 보이지 않는다.
 * compile 은 이걸 채우고, 히트·스냅은 테두리로 쓴다.
 */
export function bandOutline(band: ExplicitBand): PathPoint[] {
  const cols = band.columns;
  const first = cols[0]!;
  const last = cols[cols.length - 1]!;
  const top: PathPoint[] = [{ x: first.x0, y: first.hi }];
  const bottom: PathPoint[] = [{ x: first.x0, y: first.lo }];
  for (const col of cols) {
    const mid = (col.x0 + col.x1) / 2;
    top.push({ x: mid, y: col.hi });
    bottom.push({ x: mid, y: col.lo });
  }
  top.push({ x: last.x1, y: last.hi });
  bottom.push({ x: last.x1, y: last.lo });
  bottom.reverse();
  const pts = [...top, ...bottom, top[0]!];
  /* 샘플러 좌표는 (독립, 종속). along=y 면 세계에 (x,y)=(종속,독립). */
  return band.along === "y" ? pts.map((p) => ({ x: p.y, y: p.x })) : pts;
}

/**
 * 수학 좌표 점이 띠 안인지. 열을 이진 탐색으로 찾는다.
 * 채우기 히트는 AABB 가 아니라 열 봉투다. 쐐기의 빈 구석은 맞지 않는다.
 */
export function bandContains(band: ExplicitBand, x: number, y: number): boolean {
  const t = band.along === "y" ? y : x;
  const v = band.along === "y" ? x : y;
  if (t < band.x0 || t > band.x1 || v < band.y0 || v > band.y1) {
    return false;
  }
  const cols = band.columns;
  let lo = 0;
  let hi = cols.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const col = cols[mid]!;
    if (t < col.x0) {
      hi = mid - 1;
    } else if (t > col.x1) {
      lo = mid + 1;
    } else {
      return v >= col.lo && v <= col.hi;
    }
  }
  return false;
}
