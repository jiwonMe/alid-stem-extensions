/**
 * 변 호 라벨 자리. compile / hit / apply / anchors 가 같이 쓴다.
 * 글자는 호 꼭짓점. 각·극좌표는 점 라벨만. 호스트는 각도를 모른다.
 */
import { measureLabelMm } from "@stemfig/display";
import type { BowPoint } from "./seg-label-arc.ts";

/**
 * 샘플 한가운데. segmentBow 가 꼭짓점을 그 칸에 둔다.
 * @param bow segmentBow 결과. 비면 안 부른다
 */
export function bowApex(bow: readonly BowPoint[]): BowPoint {
  return bow[Math.floor(bow.length / 2)]!;
}

/**
 * 상자 중심이 꼭짓점에 오게 하는 baseline.
 * @param text marks[].label
 * @param sizeMm textSize
 */
export function arcLabelBaselineAt(
  apex: BowPoint,
  text: string,
  sizeMm: number,
): { x: number; y: number } {
  const box = measureLabelMm(text, sizeMm);
  return {
    x: apex.x - (box.x + box.w / 2),
    y: apex.y - (box.y + box.h / 2),
  };
}
