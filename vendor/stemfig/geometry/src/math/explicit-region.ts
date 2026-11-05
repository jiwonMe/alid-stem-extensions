/**
 * 해상 가능/불가 구간. GeoDef 를 모른다. px 기준은 explicit-screen 의 RES.
 * 적응 분할과 띠 모양은 호출 측(explicit, explicit-envelope).
 *
 * 왜 칸을 8 등분해 보는가:
 * 진동 주기가 격자보다 훨씬 짧으면 칸 경계 표본은 위상이 무작위라
 * 꺾임이 연달아 나오기도, 안 나오기도 한다. 그래서 띠가 군데군데 뚫린다.
 * 칸 안 9 점을 보면 무작위 수열도 거의 항상 두 번 이상 꺾인다.
 * 한 칸 안에서 두 번 꺾이는 곡선은 그 칸 크기로는 폴리라인으로 따라갈 수 없다 — 그게 띠다.
 * 칸 크기가 곧 "그릴 수 있다"의 기준이므로 1 단계(cellPx)는 후보만 고르고 2 단계(fineCellPx)가 결정한다.
 */
import type { XSpan } from "../path.ts";
import { RES, alignedEdges, type ScreenMap } from "./explicit-screen.ts";

/** 칸 하나를 이만큼 등분한다. */
const PROBES_PER_CELL = 8;

/**
 * 강한 판정: 한 칸 안에서 이만큼 꺾이면 그 칸 크기로는 해상 불가. 주기 ≲ 1.25 칸.
 * 봉우리 하나(sin 반주기)는 1 번이라 걸리지 않는다.
 */
const STRONG_REVERSES = 2;

/**
 * 후보 판정: 이웃 칸까지 3 칸 합이 이만큼이면 주기 ≲ 2 칸.
 * 혼자서는 띠가 아니다. 강한 칸에 이어져 있을 때만 띠에 붙는다.
 * 임계 주기 근처에서 칸마다 판정이 뒤집혀 띠·곡선이 교대로 나오는 무아레를 막는다.
 */
const CANDIDATE_REVERSES = 3;

/** 덩어리 사이 이 칸 이하 구멍은 같은 덩어리. x=0 의 NaN 한 점이 여기 든다. */
const GLUE_CELLS = 3;

/**
 * 해상 가능/불가 구간. 두 단계.
 * 1) 원점 정렬 cellPx 칸으로 후보(주기 ≲ 2.5px)를 넓게 찍는다 — 전폭을 싸게 훑는다.
 * 2) 후보 안에서만 fineCellPx 칸으로 다시 판정한다 — 정말 그릴 수 없는 곳만 남긴다.
 *    1 단계에서 바로 띠로 삼으면 주기 1~2px 진동처럼 그릴 수 있는 것까지 칠해진다.
 * [x0,x1] 등분은 팬마다 위상이 바뀌어 표본이 흔들리므로 둘 다 원점 정렬.
 * @param y parseFn 결과
 * @returns curves 는 적응 분할할 구간, packed 는 띠 구간. 둘이 [lo,hi] 를 덮는다
 */
export function classifyRegions(
  y: (x: number) => number,
  lo: number,
  hi: number,
  screen: ScreenMap,
): { curves: XSpan[]; packed: XSpan[] } {
  const packed: XSpan[] = [];
  for (const candidate of packedAt(y, lo, hi, screen, RES.cellPx)) {
    packed.push(...packedAt(y, candidate.x0, candidate.x1, screen, RES.fineCellPx));
  }
  const merged = glueSpans(packed, RES.fineCellPx / screen.pxPerUnitX);
  return { curves: complement(lo, hi, merged), packed: merged };
}

/**
 * 한 칸 크기로 [lo,hi] 를 훑어 띠 구간만 돌려준다.
 * 칸마다 꺾임 수 → 히스테리시스 → 이어 붙이기 → 작은 구멍 메우기.
 */
function packedAt(
  y: (x: number) => number,
  lo: number,
  hi: number,
  screen: ScreenMap,
  cellPx: number,
): XSpan[] {
  const edges = alignedEdges(lo, hi, screen, cellPx);
  if (edges.length < 2) {
    return [];
  }
  const counts: number[] = [];
  for (let c = 0; c < edges.length - 1; c += 1) {
    counts.push(reversesIn(y, edges[c]!, edges[c + 1]!, screen));
  }
  return glueSpans(mergePacked(edges, hysteresis(counts)), cellStep(edges));
}

/**
 * 칸별 꺾임 수 → 띠 여부.
 * 강한 칸은 항상 띠. 후보 칸은 같은 후보 연속 구간에 강한 칸이 하나라도 있을 때 띠.
 * 후보만 이어진 구간(주기 3~4px 의 균일 진동)은 곡선으로 남아 빗금처럼 그려진다.
 * 테스트를 위해 export. 다른 모듈이 직접 부를 이유는 없다.
 */
export function hysteresis(counts: number[]): boolean[] {
  const n = counts.length;
  const candidate: boolean[] = [];
  for (let c = 0; c < n; c += 1) {
    const sum = (counts[c - 1] ?? 0) + counts[c]! + (counts[c + 1] ?? 0);
    candidate.push(counts[c]! >= STRONG_REVERSES || sum >= CANDIDATE_REVERSES);
  }
  const bad = new Array<boolean>(n).fill(false);
  let c = 0;
  while (c < n) {
    if (!candidate[c]) {
      c += 1;
      continue;
    }
    let end = c;
    let anchored = false;
    while (end < n && candidate[end]) {
      anchored ||= counts[end]! >= STRONG_REVERSES;
      end += 1;
    }
    if (anchored) {
      bad.fill(true, c, end);
    }
    c = end;
  }
  return bad;
}

/**
 * 칸 안 9 점의 화면 y 가 방향을 바꾼 횟수. jumpPx 미만 변화는 무시.
 * NaN 은 건너뛴다. 한 점만 NaN 인 극(1/x 의 x=0)은 이웃 칸이 판정한다.
 *
 * 화면 y 를 뷰 박스로 클램프해서 본다. 박스 밖 움직임은 보이지 않으니 꺾임도 아니다.
 * 위 경계 → 아래 경계(또는 반대) 를 한 걸음에 넘으면 진동이 아니라 극(tan, 1/x) 의 점프다.
 * 극 양옆은 "급등 → 점프 → 급등" 이라 클램프 없이 보면 꺾임 2 번으로 보여 1px 띠가 되어 버린다.
 */
function reversesIn(
  y: (x: number) => number,
  x0: number,
  x1: number,
  screen: ScreenMap,
): number {
  const w = x1 - x0;
  /* 클램프 경계에서 경계로 가는 걸음. 부동소수 여유로 조금 덜어 본다. */
  const poleJumpPx = (screen.yBottomPx - screen.yTopPx) * 0.999;
  let prev: number | undefined;
  let dir = 0;
  let reverses = 0;
  let jumps = 0;
  for (let i = 0; i <= PROBES_PER_CELL; i += 1) {
    const v = y(x0 + (w * i) / PROBES_PER_CELL);
    if (!Number.isFinite(v)) {
      continue;
    }
    const raw = screen.toScreen(0, v).y;
    if (!Number.isFinite(raw)) {
      continue;
    }
    const sy = Math.min(screen.yBottomPx, Math.max(screen.yTopPx, raw));
    if (prev !== undefined) {
      const d = sy - prev;
      if (Math.abs(d) >= poleJumpPx) {
        /* 극을 넘었다. 방향 기억을 지우고 새로 시작한다. */
        dir = 0;
        jumps += 1;
      } else if (Math.abs(d) >= RES.jumpPx) {
        const next = d > 0 ? 1 : -1;
        if (dir !== 0 && next !== dir) {
          reverses += 1;
        }
        dir = next;
      }
    }
    prev = sy;
  }
  /*
   * 고립 극은 한 칸에 점프 하나 — 그 칸은 그릴 수 있다(두 가지가 점근선에서 끊긴다).
   * 점프가 둘 이상이면 극이 칸 안에 몰렸거나(tan(1/x) 중심) 뷰보다 큰 진폭이 칸 안에서
   * 뷰를 여러 번 가로지른 것(10·sin(1/x)) 이다. 어느 쪽이든 폴리라인으로는 못 그린다.
   */
  return reverses + Math.max(0, jumps - 1);
}

function mergePacked(edges: number[], bad: boolean[]): XSpan[] {
  const out: XSpan[] = [];
  let start: number | undefined;
  let end = 0;
  const flush = () => {
    if (start !== undefined && end > start) {
      out.push({ x0: start, x1: end });
    }
    start = undefined;
  };
  for (let i = 0; i < bad.length; i += 1) {
    if (!bad[i]) {
      flush();
      continue;
    }
    if (start === undefined) {
      start = edges[i]!;
    }
    end = edges[i + 1]!;
  }
  flush();
  return out;
}

/** 원점 정렬 격자의 한 칸. 양 끝 칸은 잘려 있어 안쪽 칸을 본다. */
function cellStep(edges: number[]): number {
  if (edges.length >= 4) {
    return edges[2]! - edges[1]!;
  }
  return edges.length >= 2 ? edges[1]! - edges[0]! : 0;
}

/** 작은 구멍(NaN 한 점, 위상 우연)은 같은 덩어리다. */
function glueSpans(spans: XSpan[], step: number): XSpan[] {
  if (spans.length < 2) {
    return spans;
  }
  const out: XSpan[] = [{ ...spans[0]! }];
  for (const span of spans.slice(1)) {
    const last = out[out.length - 1]!;
    if (span.x0 - last.x1 <= step * (GLUE_CELLS + 0.5)) {
      last.x1 = span.x1;
      continue;
    }
    out.push({ ...span });
  }
  return out;
}

function complement(lo: number, hi: number, packed: XSpan[]): XSpan[] {
  const out: XSpan[] = [];
  let at = lo;
  for (const span of packed) {
    if (span.x0 > at) {
      out.push({ x0: at, x1: span.x0 });
    }
    at = Math.max(at, span.x1);
  }
  if (hi > at) {
    out.push({ x0: at, x1: hi });
  }
  return out;
}
