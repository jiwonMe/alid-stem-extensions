/**
 * 점 라벨 자리. compile / anchors / hit 가 같이 쓴다.
 * 호스트는 각도를 모른다. 0=오른쪽, 반시계, 수학 y-up → 페이지 y-down.
 * 상자 중심 자취는 bbox 를 키운 사각형 둘레. 타원은 대각에서 변 거리가 줄어든다.
 */
import { DEFAULT_STYLE, measureLabelMm } from "@stemfig/display";
import type { HandleAnchor } from "@stemfig/host";
import { labelHandleId } from "./label-handle.ts";

/** 생략·기본. 우측 상단. */
export const LABEL_ANGLE_DEFAULT = 45;

/**
 * 키운 상자 여백. 반폭 = gap + 상자 반폭/반높이. 변↔점 거리가 이 값.
 * 0.6√2 는 예전 1.2√2 의 절반.
 */
export const LABEL_GAP_MM = 0.6 * Math.SQRT2;

/** LABEL_GAP_MM 별칭. 예전 테스트. */
export const LABEL_R_MM = LABEL_GAP_MM;

/**
 * 라벨 상자. MathJax 메트릭. 글자 수 추정이 아니다.
 * @param text objects[].label
 * @param size_mm textSize
 * @returns 로컬 mm. y 는 상자 위. baseline 이 (0,0)
 */
export function labelHitBox(
  text: string,
  size_mm: number,
): { x: number; y: number; w: number; h: number } {
  return measureLabelMm(text, size_mm);
}

/**
 * 중심이 도는 사각형 반폭. bbox + gap.
 * @param box labelHitBox
 * @param gapMm objects[].labelDistance. 없으면 LABEL_GAP_MM
 */
export function labelOrbitAxes(
  box: { w: number; h: number },
  gapMm = LABEL_GAP_MM,
): {
  a: number;
  b: number;
} {
  const gap = Math.max(0, gapMm);
  return {
    a: gap + box.w / 2,
    b: gap + box.h / 2,
  };
}

/**
 * 원점에서 방향 u 로 나간 레이와 |x|≤a, |y|≤b 둘레의 교점.
 * 축 성분이 0 이면 그 변은 무한.
 */
export function rectRayHit(
  a: number,
  b: number,
  ux: number,
  uy: number,
): [number, number] {
  const tx = Math.abs(ux) < 1e-12 ? Number.POSITIVE_INFINITY : a / Math.abs(ux);
  const ty = Math.abs(uy) < 1e-12 ? Number.POSITIVE_INFINITY : b / Math.abs(uy);
  const t = Math.min(tx, ty);
  return [t * ux, t * uy];
}

/**
 * 점 원에서 라벨 baseline 로컬 mm.
 * 중심은 키운 사각형 둘레. 위아래는 높이만 본다.
 * @param angleDeg 0–360. 없으면 45
 * @param text 상자 폭. 기본 "A" 는 상수 테스트용
 * @param size_mm textSize
 * @param gapMm objects[].labelDistance. 없으면 기본 여백
 */
export function labelOffsetMm(
  angleDeg = LABEL_ANGLE_DEFAULT,
  text = "A",
  size_mm = DEFAULT_STYLE.textSize,
  gapMm = LABEL_GAP_MM,
): [number, number] {
  const box = labelHitBox(text, size_mm);
  const { a, b } = labelOrbitAxes(box, gapMm);
  const rad = (angleDeg * Math.PI) / 180;
  const [cx, cy] = rectRayHit(a, b, Math.cos(rad), -Math.sin(rad));
  /* 궤도 점은 상자 중심. baseline 은 valign 만큼 내려갈 수 있다. */
  return [cx - (box.x + box.w / 2), cy - (box.y + box.h / 2)];
}

/**
 * 상자 중심의 로컬 오프셋 → 각·거리.
 * apply 가 드래그 뒤 중심을 여기로 되돌린다. 점은 안 옮긴다.
 * 각은 0=오른쪽, 반시계, 수학 y-up. 거리는 변↔점 간격.
 * 원점이면 각을 정할 수 없다. 호출 측이 이전 각을 유지한다.
 * @param vx 상자 중심 − 점. 로컬 mm. y 아래가 +
 * @param vy 상자 중심 − 점. 로컬 mm
 * @param box labelHitBox. 반폭만 쓴다
 * @returns 0–360°, gap ≥ 0
 */
export function labelPoseFromOffset(
  vx: number,
  vy: number,
  box: { w: number; h: number },
): { angle: number; distance: number } {
  const hx = box.w / 2;
  const hy = box.h / 2;
  const distance = Math.max(0, Math.max(Math.abs(vx) - hx, Math.abs(vy) - hy));
  let angle = (Math.atan2(-vy, vx) * 180) / Math.PI;
  if (angle < 0) {
    angle += 360;
  }
  return { angle, distance };
}

/** 45° "A" 오프셋. 예전 테스트가 같은 값을 쓰게. */
export const LABEL_DX_MM = labelOffsetMm()[0];
/** 45° "A" 오프셋. 페이지 위가 음수. */
export const LABEL_DY_MM = labelOffsetMm()[1];

/**
 * 점 페이지 mm → 라벨 baseline 페이지 mm.
 * @param angleDeg objects[].labelAngle. 없으면 45
 * @param gapMm objects[].labelDistance
 */
export function pointLabelPage(
  cx: number,
  cy: number,
  angleDeg?: number,
  text = "A",
  size_mm = DEFAULT_STYLE.textSize,
  gapMm = LABEL_GAP_MM,
): [number, number] {
  const [dx, dy] = labelOffsetMm(
    angleDeg ?? LABEL_ANGLE_DEFAULT,
    text,
    size_mm,
    gapMm,
  );
  return [cx + dx, cy + dy];
}

/**
 * 보이는 점 라벨 HUD. 빈 문자열은 빼다.
 * id 는 점과 다르다. 같으면 apply 가 점을 민다.
 * owner 는 HUD 짝. 점 hover 가 글자도 켜게.
 * @param obj objects 한 줄. label·labelAngle·labelDistance
 * @param cx 점 페이지 mm
 * @param cy 점 페이지 mm
 * @param size_mm CompileCtx.style.textSize
 * @returns 없거나 빈 라벨이면 undefined
 */
export function labelAnchor(
  obj: {
    id: string;
    label?: string;
    labelAngle?: number;
    labelDistance?: number;
  },
  cx: number,
  cy: number,
  size_mm: number,
): HandleAnchor | undefined {
  if (!obj.label) {
    return undefined;
  }
  const [x_mm, y_mm] = pointLabelPage(
    cx,
    cy,
    obj.labelAngle,
    obj.label,
    size_mm,
    obj.labelDistance,
  );
  return {
    id: labelHandleId(obj.id),
    kind: "text",
    x_mm,
    y_mm,
    text: obj.label,
    size_mm,
    owner: obj.id,
  };
}
