/**
 * 축정렬 상자 대수. 선·글리프 자르기는 clip-geom / clip-label.
 * figure.frame ∩ 시트 를 여기서만 계산한다.
 */
import type { Frame } from "../types.ts";

/**
 * 두 상자가 면적으로 겹치면 true. 맞닿은 변은 겹친 것으로 본다.
 */
export function framesOverlap(a: Frame, b: Frame): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * inner 가 outer 안에 완전히 들어가면 true. 경계는 안.
 */
export function frameContains(outer: Frame, inner: Frame): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

/**
 * 교집합. 안 겹치면 undefined.
 * figure 가 시트 밖으로 나가면 시트 밖은 그리지 않는다.
 * @returns 폭·높이가 0 이하면 undefined
 */
export function intersectFrames(a: Frame, b: Frame): Frame | undefined {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= x || bottom <= y) {
    return undefined;
  }
  return { x, y, w: right - x, h: bottom - y };
}
