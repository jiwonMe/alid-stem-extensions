/**
 * 화살표와 경로 선분의 극좌표 행.
 * 장면 길이와 도만 보여 준다. 속도를 계산하지 않는다.
 */
import type { InspectField } from "@stemfig/host";
import type { MechanicsObject, Vec } from "../schema.ts";

/**
 * 선택한 꼭짓점과 앞 꼭짓점 사이 선분의 길이와 각도.
 * @param object 경로
 * @param index 꼭짓점 번호. 0 이면 앞 선분이 없어 빈 배열
 * @returns 길이·각도 행
 */
export function readPolarFields(object: Extract<MechanicsObject, { type: "track" }>, index: number): InspectField[] {
  const prev = object.points[index - 1];
  const current = object.points[index];
  if (!prev || !current) return [];
  return [
    num("segmentLength", "앞 선분 길이", Math.hypot(current[0] - prev[0], current[1] - prev[1])),
    num("segmentAngle", "앞 선분 각도", Math.atan2(current[1] - prev[1], current[0] - prev[0]) * 180 / Math.PI, "°"),
  ];
}

/**
 * 힘 화살표의 크기와 방향.
 * @param delta 장면 성분
 * @returns 극좌표 두 행
 */
export function readForcePolar(delta: Vec): InspectField[] {
  return [
    num("magnitude", "크기", Math.hypot(delta[0], delta[1])),
    num("direction", "방향", Math.atan2(delta[1], delta[0]) * 180 / Math.PI, "°"),
  ];
}

function num(key: string, label: string, value: number, unit?: string): InspectField {
  return { key, label, type: "number", value, step: unit === "°" ? 1 : 0.1, ...(unit ? { unit } : {}) };
}
