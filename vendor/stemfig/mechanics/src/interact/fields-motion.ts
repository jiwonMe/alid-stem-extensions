/**
 * 공·점·포물선·각도·지면의 속성 행.
 * 앱은 행 타입만 그린다. 발사각 설명에 도착 방향과 최고점 높이를 적어 빗면을 맞출 때 쓴다.
 * 늘이기 보기가 켜진 각도는 장면 기준이라 인쇄와 다를 수 있음을 적는다.
 */
import type { InspectField } from "@stemfig/host";
import { degreeTex } from "@stemfig/plugin-kit";
import { referencePoint, type MechanicsState } from "../init.ts";
import { apexPoint, tangentOnFlight } from "../projectile-geometry.ts";
import { measuredAngle, rayPoint } from "../rays.ts";
import type { MechanicsObject } from "../schema.ts";
import { objectChoiceName } from "./fields-groups.ts";

/**
 * @param state 현재 장면. 포물선 설명에 파생 각도를 넣는다
 * @param object 공·점·포물선·각도
 * @returns 모양·연결 행. 예외를 던지지 않는다
 */
export function readMotionFields(state: MechanicsState, object: MechanicsObject): InspectField[] {
  if (object.type === "ball") return ballFields(state, object);
  if (object.type === "point") return pointFields(state, object);
  if (object.type === "trajectory") return trajectoryFields(state, object);
  if (object.type === "angle") return angleFields(state, object);
  return [];
}

function ballFields(state: MechanicsState, object: Extract<MechanicsObject, { type: "ball" }>): InspectField[] {
  const pose = object.pose;
  return [
    num("radius", "반지름", object.radius, { min: 0 }),
    fillField(object.fill, ["paper", "shade", "ink"], ["흰색", "회색", "먹"]),
    choice("track", "부착 경로", pose.mode === "track" ? `track:${pose.track}` : "free", tracks(state)),
    ...(pose.mode === "free" ? [num("x", "X", pose.point[0]), num("y", "Y", pose.point[1])]
      : [num("t", "경로상 위치", pose.t * 100, { min: 0, max: 100, step: 1, unit: "%" }), num("offset", "경로 간격", pose.offset)]),
  ];
}

function pointFields(state: MechanicsState, object: Extract<MechanicsObject, { type: "point" }>): InspectField[] {
  const at = referencePoint(object.at, state);
  return [num("x", "X", at[0]), num("y", "Y", at[1])];
}

function trajectoryFields(state: MechanicsState, object: Extract<MechanicsObject, { type: "trajectory" }>): InspectField[] {
  const flight = state.curves.get(object.id);
  const arrival = flight ? Math.atan2(tangentOnFlight(flight, flight.D)[1], Math.abs(tangentOnFlight(flight, flight.D)[0])) * 180 / Math.PI : undefined;
  const height = flight ? apexPoint(flight)[1] - flight.a[1] : undefined;
  return [
    { key: "angle", label: "발사각", type: "number", value: object.angle, unit: "°", step: 1, min: -88.9, max: 88.9,
      description: flight ? `도착 방향 ${arrival!.toFixed(1)}°, 시작점 기준 최고점 높이 ${height!.toFixed(2)}. 늘이기 보기는 이 각도와 인쇄가 달라질 수 있습니다.` : undefined,
      group: { id: "shape", label: "모양", defaultOpen: true } },
    num("arrowCount", "진행 화살촉", object.arrows.length, { min: 0, max: 3, step: 1 }),
    bool("launch", "발사 속도", Boolean(object.launch)),
    bool("launchAngle", "발사각 표시", Boolean(object.launchAngle)),
    bool("arrival", "도착 속도", Boolean(object.arrival)),
    bool("apex", "최고점", Boolean(object.apex)),
  ];
}

function angleFields(state: MechanicsState, object: Extract<MechanicsObject, { type: "angle" }>): InspectField[] {
  const vertex = referencePoint(object.v, state);
  const degrees = measuredAngle(vertex, rayPoint(object.a, vertex, state), rayPoint(object.b, vertex, state));
  return [
    choice("mark", "표시", object.mark, [{ value: "arc", label: "호" }, { value: "right", label: "직각" }]),
    bool("auto", "각도 자동", object.auto),
    { key: "measured", label: "측정 각도", type: "text", value: degrees === undefined ? "" : degreeTex(degrees), disabled: true },
  ];
}

function tracks(state: MechanicsState): { value: string; label: string }[] {
  return [{ value: "free", label: "자유 배치" }, ...state.spec.objects.filter((object) => object.type === "track")
    .map((object) => ({ value: `track:${object.id}`, label: objectChoiceName(object, state) }))];
}

function fillField(value: string, values: string[], labels: string[]): InspectField {
  return { key: "fill", label: "채움", type: "enum", value, appearance: "segmented", options: values.map((item, index) => ({ value: item, label: labels[index]! })) };
}

function bool(key: string, label: string, value: boolean): InspectField {
  return { key, label, type: "boolean", value, group: { id: key, label, defaultOpen: false } };
}

function num(key: string, label: string, value: number, extra: Partial<Extract<InspectField, { type: "number" }>> = {}): InspectField {
  return { key, label, type: "number", value, step: 0.1, ...extra };
}

function choice(key: string, label: string, value: string, options: { value: string; label: string }[]): InspectField {
  return { key, label, type: "enum", value, options };
}
