/**
 * figure 격자·축. View 의 장식이지 교과 객체가 아니다.
 * 문서 봉투가 들고, 호스트 compile 이 그린다. spec 에 두지 말 것.
 */

/**
 * 격자. 키를 빼면 끈다. show:false 도 끈다.
 * step 은 사용자 좌표. stroke/width 는 페이지 mm.
 */
export type Grid = {
  show?: boolean;
  /** 세로선 간격. 양수. 없으면 1 */
  stepX?: number;
  /** 가로선 간격. 양수. 없으면 stepX 또는 1 */
  stepY?: number;
  minor?: boolean;
  /** 주 칸 등분. 2–10. 없으면 2 */
  subdivisions?: number;
  stroke?: string;
  width?: number;
  /** 보조 격자도 compileGrid 와 같은 페이지 mm 스타일을 보존한다. */
  minorStroke?: string;
  minorWidth?: number;
};

/**
 * 한 축 눈금. 축과 같은 사용자 간격.
 * show 를 true 로 켜기 전에는 그리지 않는다.
 */
export type Ticks = {
  show?: boolean;
  stepX?: number;
  stepY?: number;
  labels?: boolean;
  minor?: boolean;
  subdivisions?: number;
};

/**
 * x 또는 y 한 줄. show:false 면 그 축만 끈다.
 */
export type Axis = {
  show?: boolean;
  label?: string;
  stroke?: string;
  width?: number;
};

/**
 * 축 쌍. 키를 빼면 끈다. ticks 는 두 축 공용.
 * 라벨·화살표·원점 O 기본은 켠다. 눈금은 끈다. 빈 문자열 라벨은 숨긴다.
 */
export type Axes = {
  show?: boolean;
  x?: Axis;
  y?: Axis;
  stroke?: string;
  width?: number;
  ticks?: Ticks;
  /** 끝 델토이드. 없으면 켠다 */
  arrows?: boolean;
  /** 원점 O. 창에 0 이 있고 두 축이 만날 때만. 없으면 켠다 */
  origin?: boolean;
  /** 없으면 $\rm{O}$. 빈 칸은 숨긴다 */
  originLabel?: string;
};

/**
 * 격자 잠금. #cccccc / 0.15 는 구 math.plot chrome.
 * 보조선은 더 옅게. 선 개수 상한은 DisplayList 폭발 방지.
 */
export const GRID_DEFAULT = {
  step: 1,
  subdivisions: 2,
  stroke: "#cccccc",
  width: 0.15,
  minorStroke: "#eeeeee",
  minorWidth: 0.1,
  maxLines: 80,
} as const;

/**
 * 축 눈금·마커. 길이는 페이지 mm 고정. 창을 줌해도 커지지 않게.
 * 라벨은 $...$ — texSource 가 mathrm 이 아니라 수식 이탤릭으로 조판하게.
 * 화살은 TikZ stealth. 꼭짓점·어깨·오목 홈. 마름모(뒤 꼭짓점)가 아니다.
 * 길이·반폭은 예전 2.0 / 0.56 의 2/3. 홈·옆오목 비율은 그대로. 축 선은 홈에서 끊는다.
 */
export const AXES_DEFAULT = {
  step: 1,
  subdivisions: 2,
  tickLen: 1.2,
  minorTickLen: 0.7,
  labelOffset: 2.4,
  /* textSize 와 같이 계획 값의 절반. */
  tickTextSize: 1.2,
  maxTicks: 80,
  xLabel: "$x$",
  yLabel: "$y$",
  originLabel: "$\\rm{O}$",
  /* 교과 선 0.2mm 의 절반. 축만. */
  width: 0.1,
  arrowLen: (2.0 / 3) * 2,
  arrowHalf: (0.56 / 3) * 2,
  arrowInset: 0.18,
  /* tip-어깨 중점을 중심선 쪽으로. 반폭 비율. */
  arrowSidePinch: 0.13,
  /* 마커와 축 이름 사이. 멀리 띄우지 않는다. */
  labelPad: 0.4,
  /* 원점과 O 상자. 제3사분면. */
  originGap: 0.6,
} as const;

/**
 * 격자 키가 있고 show 가 false 가 아니면 켠다.
 */
export function gridOn(grid: Grid | undefined): boolean {
  return grid !== undefined && grid.show !== false;
}

/**
 * 축 키가 있고 show 가 false 가 아니면 켠다.
 */
export function axesOn(axes: Axes | undefined): boolean {
  return axes !== undefined && axes.show !== false;
}

/**
 * 눈금. 키가 없거나 show 가 true 가 아니면 끈다.
 */
export function ticksOn(ticks: Ticks | undefined): boolean {
  return ticks?.show === true;
}

/**
 * 한 축. 마스터가 꺼져 있으면 둘 다 꺼진다.
 */
export function axisOn(axes: Axes | undefined, which: "x" | "y"): boolean {
  if (!axesOn(axes) || !axes) {
    return false;
  }
  return axes[which]?.show !== false;
}

/**
 * 0 이 구간에 있으면 0, 아니면 0 에 가까운 끝.
 * 창이 원점을 벗어나면 축을 상자 가장자리에 붙인다.
 */
export function axisPos(min: number, max: number): number {
  if (min <= 0 && 0 <= max) {
    return 0;
  }
  return Math.abs(min) < Math.abs(max) ? min : max;
}
