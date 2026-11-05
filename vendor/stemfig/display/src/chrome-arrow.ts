/**
 * 축 끝 stealth 마커와 수식 라벨 문자열.
 * 페이지 mm. 교과·문서를 모른다.
 */
import { AXES_DEFAULT } from "./chrome.ts";
import type { DisplayItem, Frame } from "./types.ts";

/**
 * 양 끝으로 방향 단위벡터. 길이가 0 이면 undefined.
 */
export function axisDir(
  tail: [number, number],
  tip: [number, number],
): [number, number] | undefined {
  const dx = tip[0] - tail[0];
  const dy = tip[1] - tail[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) {
    return undefined;
  }
  return [dx / len, dy / len];
}

/**
 * x축을 figure.frame 가로 끝까지.
 * contain 여백에 끊지 않는다. 눈금은 view 안에 남긴다.
 * @param atY 수학 y0 의 페이지 mm
 */
export function axisRailX(
  frame: Frame,
  atY: number,
): { tail: [number, number]; tip: [number, number] } {
  return {
    tail: [frame.x, atY],
    tip: [frame.x + frame.w, atY],
  };
}

/**
 * y축을 figure.frame 세로 끝까지. tip 은 상자 위.
 * @param atX 수학 x0 의 페이지 mm
 */
export function axisRailY(
  frame: Frame,
  atX: number,
): { tail: [number, number]; tip: [number, number] } {
  return {
    tail: [atX, frame.y + frame.h],
    tip: [atX, frame.y],
  };
}

/**
 * 축 선이 끝나는 홈. 화살이 선을 덮어 삼각형으로 보이지 않게.
 * @returns 없으면 선을 끝까지
 */
export function arrowStop(
  tip: [number, number],
  tail: [number, number],
): [number, number] | undefined {
  const dir = axisDir(tail, tip);
  if (!dir) {
    return undefined;
  }
  const [ux, uy] = dir;
  const inset = AXES_DEFAULT.arrowLen * (1 - AXES_DEFAULT.arrowInset);
  return [tip[0] - ux * inset, tip[1] - uy * inset];
}

/** stealth 화살촉 크기. 비율을 생략하면 축 기본값을 쓴다. */
export type StealthMetrics = {
  /** 꼭짓점에서 어깨까지. 페이지 mm */
  len: number;
  /** 어깨 반폭. 페이지 mm */
  half: number;
  /** 홈이 어깨에서 꼭짓점 쪽으로 들어오는 길이 비율. */
  inset?: number;
  /** 옆점을 중심선으로 당기는 반폭 비율. */
  sidePinch?: number;
};

/**
 * TikZ stealth. 꼭짓점 → 옆오목 → 어깨 → 홈 → 어깨 → 옆오목.
 * 크기는 호출 측이 고른다. 축은 봉투 기본값을 넘긴다.
 * @param tip 양의 끝. 페이지 mm
 * @param tail 반대쪽 끝. 방향만 쓴다
 * @param fill 잉크. stroke 는 안 넣는다. round join 이 꼭짓점을 뭉개지 않게
 * @param metrics 길이와 반폭. 짧으면 호출 측이 줄여서 넘긴다
 * @returns 길이가 0이면 undefined
 */
export function stealthHead(
  tip: [number, number],
  tail: [number, number],
  fill: string,
  metrics: StealthMetrics,
): DisplayItem | undefined {
  const dir = axisDir(tail, tip);
  if (!dir || !(metrics.len > 0) || !(metrics.half > 0)) {
    return undefined;
  }
  const [ux, uy] = dir;
  const px = -uy;
  const py = ux;
  const len = metrics.len;
  const half = metrics.half;
  const inset = len * (metrics.inset ?? AXES_DEFAULT.arrowInset);
  const pinch = half * (metrics.sidePinch ?? AXES_DEFAULT.arrowSidePinch);
  const back: [number, number] = [tip[0] - ux * len, tip[1] - uy * len];
  const notch: [number, number] = [back[0] + ux * inset, back[1] + uy * inset];
  const left: [number, number] = [back[0] + px * half, back[1] + py * half];
  const right: [number, number] = [back[0] - px * half, back[1] - py * half];
  const leftMid = pinchToward(mid(tip, left), px, py, -pinch);
  const rightMid = pinchToward(mid(tip, right), px, py, pinch);
  return {
    op: "polygon",
    points: [tip, leftMid, left, notch, right, rightMid],
    stroke: "none",
    fill,
    width: 0,
  };
}

/**
 * 몸통이 화살촉 홈에서 끊기는 점. 선이 꼭짓점까지 가면 끝이 뭉개진다.
 * @param tip 화살 끝
 * @param tail 출발 쪽. 방향만 쓴다
 * @param metrics stealthHead 와 같은 크기
 * @returns 페이지 mm. 길이가 0이면 undefined
 */
export function stealthNotch(
  tip: [number, number],
  tail: [number, number],
  metrics: StealthMetrics,
): [number, number] | undefined {
  const dir = axisDir(tail, tip);
  if (!dir || !(metrics.len > 0)) return undefined;
  const inset = metrics.inset ?? AXES_DEFAULT.arrowInset;
  const back = metrics.len * (1 - inset);
  return [tip[0] - dir[0] * back, tip[1] - dir[1] * back];
}

/**
 * 축 화살촉. 봉투 기본 길이를 stealthHead 에 넘긴다.
 * @param tip 양의 끝. 페이지 mm
 * @param tail 반대쪽 끝. 방향만 쓴다
 * @param fill 축 잉크
 */
export function axisDeltoid(
  tip: [number, number],
  tail: [number, number],
  fill: string,
): DisplayItem | undefined {
  return stealthHead(tip, tail, fill, {
    len: AXES_DEFAULT.arrowLen,
    half: AXES_DEFAULT.arrowHalf,
    inset: AXES_DEFAULT.arrowInset,
    sidePinch: AXES_DEFAULT.arrowSidePinch,
  });
}

function mid(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function pinchToward(
  point: [number, number],
  px: number,
  py: number,
  amount: number,
): [number, number] {
  return [point[0] + px * amount, point[1] + py * amount];
}

/**
 * 짧은 라벨을 $...$ 로. 이미 수식이면 그대로.
 * texSource 가 한 글자를 mathrm 으로 굳히지 않게.
 */
export function mathLabel(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  if (trimmed.startsWith("$") && trimmed.endsWith("$") && trimmed.length >= 2) {
    return trimmed;
  }
  if (/[\\^_{}]/.test(trimmed)) {
    return trimmed;
  }
  return `$${trimmed}$`;
}

/**
 * 저장된 라벨. undefined 는 fallback. 빈 칸은 숨긴다.
 */
export function resolvedLabel(
  stored: string | undefined,
  fallback: string,
): string | undefined {
  if (stored === "") {
    return undefined;
  }
  return mathLabel(stored ?? fallback);
}
