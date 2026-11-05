/**
 * explicit 샘플링의 px 기준. 여기 px 는 전부 시트 px(1mm = 4px) 다. 호스트 camera 가 아니다.
 *
 * "얼마나 촘촘해야 그린 것으로 치는가" 를 정하는 숫자는 서로 묶여 있다.
 * 허용 오차·해상 한계·분류 칸·초기 격자를 여기 한 곳에서 파생시켜 하나를 바꾸면 나머지가 따라온다.
 * 다른 explicit-* 모듈은 RES 와 ScreenMap 만 받고 px 를 스스로 정하지 않는다.
 */
import type { PathPoint, ViewBox } from "../path.ts";

/**
 * 시트 px 하나가 화면에서 최대 몇 px 로 보이는가. 에디터 카메라 최대 줌.
 * 앱 상수(camera.ts MAX_ZOOM)를 플러그인이 알 수는 없으므로 여기 한 번만 적고 파생값에만 쓴다.
 */
const OVERSAMPLE = 8;

/**
 * 1 단계 분류 칸. euclidraw INITIAL_SAMPLE_SPACING_PX.
 * 초기 격자는 이 칸의 약수라 초기 표본이 칸 경계를 포함한다.
 */
const CELL_PX = 2;

/**
 * 잠긴 px 상수. 전부 시트 px.
 * - tolerancePx: 현 편차 허용. 최대 줌에서 0.4 화면 px. euclidraw 0.3 은 화면 px 였다
 * - minResolvePx: 적응 분할 해상 한계. 허용 오차와 같아 분할이 오차까지 내려간다
 * - cellPx: 1 단계 분류 칸(후보 탐색)
 * - fineCellPx: 2 단계 분류 칸. 이 주기 아래만 정말 그릴 수 없다(최대 줌에서 2 화면 px)
 * - spacingPx: 적응 분할 초기 격자. 부드러운 곡선도 픽셀마다 정점
 * - columnPx: 띠 봉투 열 폭
 * - strokePx: 스트로크 굵기. 띠 최소 두께, 꺾임 잡음 하한의 기준
 * - jumpPx: 이보다 작은 세로 꺾임은 잡음. 스트로크 1px 아래는 보이지 않는다
 */
export const RES = {
  oversample: OVERSAMPLE,
  tolerancePx: 0.4 / OVERSAMPLE,
  minResolvePx: 0.4 / OVERSAMPLE,
  cellPx: CELL_PX,
  fineCellPx: CELL_PX / OVERSAMPLE,
  spacingPx: CELL_PX / 2,
  columnPx: 1,
  strokePx: 1,
  jumpPx: 1.5,
} as const;

/**
 * ViewBox → 시트 px. 스케일은 반옥타브 양자화, 원점은 수학 0.
 * yTopPx/yBottomPx 는 박스의 화면 y 범위(y-down). 클램프·점근선·띠 두께가 같은 값을 쓴다.
 */
export type ScreenMap = {
  box: ViewBox;
  pxPerUnitX: number;
  pxPerUnitY: number;
  yTopPx: number;
  yBottomPx: number;
  toScreen: (x: number, y: number) => PathPoint;
};

/**
 * 반옥타브로 묶는다. 뷰를 조금 바꿀 때마다 표본이 바뀌지 않게.
 * @param pxPerUnit 박스 가로 / 시트 px
 */
export function quantizePxPerUnit(pxPerUnit: number): number {
  if (!(pxPerUnit > 0) || !Number.isFinite(pxPerUnit)) {
    return pxPerUnit;
  }
  return 2 ** (Math.round(Math.log2(pxPerUnit) * 2) / 2);
}

/**
 * ViewBox → ScreenMap. 팬·작은 줌에 표본이 흔들리지 않는다.
 * @param widthPx frame.w * MM_TO_PX. 테스트는 생략 측에서 기본값을 넣는다
 * @returns 폭·높이가 없으면 undefined
 */
export function screenMap(box: ViewBox, widthPx: number): ScreenMap | undefined {
  const boxW = box.xmax - box.xmin;
  const boxH = box.ymax - box.ymin;
  if (!(boxW > 0) || !(boxH > 0) || !(widthPx > 0)) {
    return undefined;
  }
  const pxPerUnitX = quantizePxPerUnit(widthPx / boxW);
  const pxPerUnitY = pxPerUnitX * (boxH / boxW);
  if (!(pxPerUnitX > 0) || !(pxPerUnitY > 0)) {
    return undefined;
  }
  const toScreen = (x: number, y: number): PathPoint => ({
    x: x * pxPerUnitX,
    y: -y * pxPerUnitY,
  });
  return {
    box,
    pxPerUnitX,
    pxPerUnitY,
    yTopPx: toScreen(0, box.ymax).y,
    yBottomPx: toScreen(0, box.ymin).y,
    toScreen,
  };
}

/** 격자 칸 수 상한. 뷰 밖 domain 은 호출 측이 잘라 넘긴다. 2 단계 전폭(560px/0.25) 이 든다. */
const MAX_CELLS = 4096;

/**
 * 원점 정렬 격자 경계. 안쪽은 k·dx, 양 끝은 lo/hi.
 * 분류 칸과 적응 분할 초기 표본이 같은 격자를 쓴다. 그래야 팬·작은 줌에 정점이 같은 자리에 남는다.
 * [lo,hi] 등분은 팬마다 위상이 바뀐다.
 * @param spacingPx 칸 폭 px
 * @returns dx 가 0 이거나 무한이면 [lo, hi]
 */
export function alignedEdges(
  lo: number,
  hi: number,
  screen: ScreenMap,
  spacingPx: number,
): number[] {
  const dx = spacingPx / screen.pxPerUnitX;
  const edges: number[] = [lo];
  if (!(dx > 0) || !Number.isFinite(dx)) {
    edges.push(hi);
    return edges;
  }
  /* k·dx 를 정수 k 로 직접 만든다. start+k·dx 는 lo 마다 ULP 가 달라 정점이 미세하게 흔들린다. */
  const k0 = Math.ceil((lo + dx * 1e-9) / dx);
  for (let k = k0; k < k0 + MAX_CELLS; k += 1) {
    const x = k * dx;
    if (x >= hi - dx * 1e-9) {
      break;
    }
    if (x > lo) {
      edges.push(x);
    }
  }
  edges.push(hi);
  return edges;
}
