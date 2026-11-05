/**
 * figure.view 창을 민다.
 * 교과를 모른다. fitView 와 같은 직사각형만 다룬다.
 * 페이지 카메라는 호출 측. 여기는 frame 로컬 mm.
 */
import { fitView, type View } from "./fit-view.ts";
import type { Frame } from "./types.ts";

/** 휠·패널 기본은 양 축. 패널에서 Lock 을 풀면 한 축만. */
export type ViewZoomAxis = "both" | "x" | "y";

/**
 * 종이를 잡는 팬. 로컬 mm 만큼 그림이 따라가게 창을 반대로 민다.
 * y-up 이라 화면 아래(로컬 y+)로 끌면 ymin/ymax 가 커진다.
 * stretch 면 축마다 스케일이 다르다.
 * @param dx_local_mm frame 로컬, 오른쪽이 +
 * @param dy_local_mm frame 로컬, 아래가 +
 * @returns 종횡비·stretch 를 유지한 새 창. 스케일이 0 이면 입력
 */
export function nudgeViewPan(
  view: View,
  frame: Frame,
  dx_local_mm: number,
  dy_local_mm: number,
): View {
  const { scaleX, scaleY } = fitView(view, frame);
  if (!(scaleX > 0) || !(scaleY > 0)) {
    return view;
  }
  const dx = dx_local_mm / scaleX;
  const dy = dy_local_mm / scaleY;
  return {
    ...view,
    xmin: view.xmin - dx,
    xmax: view.xmax - dx,
    ymin: view.ymin + dy,
    ymax: view.ymax + dy,
  };
}

/**
 * 커서 아래 수학점이 고정되도록 창을 확대·축소한다.
 * 기본(both)은 양 축. factor > 1 이면 확대(창이 줄어든다).
 * @param lx frame 로컬 mm
 * @param ly frame 로컬 mm
 * @param factor 1보다 크면 확대
 * @param axis 기본 both. stretch 패널만 x 또는 y
 * @returns 새 창. factor 가 비정상이면 입력
 */
export function nudgeViewZoomAt(
  view: View,
  frame: Frame,
  lx: number,
  ly: number,
  factor: number,
  axis: ViewZoomAxis = "both",
): View {
  if (!(factor > 0) || !Number.isFinite(factor)) {
    return view;
  }
  const [cx, cy] = fitView(view, frame).fromLocal(lx, ly);
  const next: View = {
    ...view,
    xmin:
      axis === "y" ? view.xmin : cx - (cx - view.xmin) / factor,
    xmax:
      axis === "y" ? view.xmax : cx + (view.xmax - cx) / factor,
    ymin:
      axis === "x" ? view.ymin : cy - (cy - view.ymin) / factor,
    ymax:
      axis === "x" ? view.ymax : cy + (view.ymax - cy) / factor,
  };
  if (!(next.xmin < next.xmax && next.ymin < next.ymax)) {
    return view;
  }
  return next;
}

/**
 * 상자 크기가 바뀌어도 스케일은 유지. 움직인 변 쪽으로 창만 민다.
 * 통째 이동에는 쓰지 말 것. 양 끝이 같이 움직이면 창이 밀려 그림이 어긋난다.
 * y-up. 위 변은 ymax, 아래 변은 ymin.
 * @param from 리사이즈 전 frame
 * @param to 리사이즈 후 frame
 */
export function resizeView(view: View, from: Frame, to: Frame): View {
  const { scaleX, scaleY } = fitView(view, from);
  if (!(scaleX > 0) || !(scaleY > 0)) {
    return view;
  }
  const dLeft = to.x - from.x;
  const dRight = to.x + to.w - (from.x + from.w);
  const dTop = to.y - from.y;
  const dBottom = to.y + to.h - (from.y + from.h);
  const next: View = {
    ...view,
    xmin: view.xmin + dLeft / scaleX,
    xmax: view.xmax + dRight / scaleX,
    ymin: view.ymin - dBottom / scaleY,
    ymax: view.ymax - dTop / scaleY,
  };
  if (!(next.xmin < next.xmax && next.ymin < next.ymax)) {
    return view;
  }
  return next;
}
