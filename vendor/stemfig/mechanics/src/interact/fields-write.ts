/**
 * 검증을 통과한 속성 한 칸을 역학 객체의 새 원본으로 바꾼다.
 * 문자열 키의 의미는 이 플러그인만 알며 호스트의 문서나 undo를 소유하지 않는다.
 * 전체 schema와 참조 검증을 실행하는 fields.ts가 반환값을 최종 승인한다.
 */
import type { FieldPatch } from "@stemfig/host";
import { nearestOnTrack } from "../geometry.ts";
import { referencePoint, type MechanicsState } from "../init.ts";
import type { MechanicsObject, PointRef, Vec } from "../schema.ts";
import { targetReference, type FieldTarget } from "./fields-read.ts";

/**
 * @param state 현재 파생 상태
 * @param target 존재가 확인된 객체·손잡이
 * @param patch 속성 행의 타입·범위 검증을 통과한 값
 * @returns 후보 객체. 미지원 조합이나 누락된 참조는 원본을 반환하고 예외를 던지지 않는다.
 */
export function writeMechanicsObject(state: MechanicsState, target: FieldTarget, patch: FieldPatch): MechanicsObject {
  const { object, part, index } = target;
  const { key, value } = patch;
  if (!part || part === "label") {
    if (key === "label" && typeof value === "string") return { ...object, label: value };
    if (key === "labelSize" && typeof value === "number") return { ...object, labelSize: value };
    if ((key === "show" || key === "dashed") && typeof value === "boolean") return { ...object, [key]: value };
    if (key === "stroke" && typeof value === "string") return writeStroke(object, value);
    if (key === "weight" && typeof value === "string") return writeWeight(object, value);
    if ((key === "labelOffsetX" || key === "labelOffsetY") && typeof value === "number") {
      return { ...object, labelOffset: coordinate(object.labelOffset ?? [0, 0], key === "labelOffsetX" ? "x" : "y", value) };
    }
  }
  if (part === "label") return object;
  if (part === "point" && object.type === "track" && typeof value === "number") {
    if (key === "segmentLength" || key === "segmentAngle") return writeSegment(object, index!, key, value);
    return { ...object, points: object.points.map((p, i) => i === index ? coordinate(p, key, value) : p) };
  }
  if (part === "point" && object.type === "support" && typeof value === "number") return { ...object, point: coordinate(object.point, key, value) };
  if (object.type === "pulley" && typeof value === "number") {
    if ((part === "center" || !part) && (key === "x" || key === "y")) return { ...object, center: coordinate(object.center, key, value) };
    if ((part === "radius" || !part) && key === "radius") return { ...object, radius: value };
  }
  if (part === "end" && object.type === "force" && typeof value === "number") {
    const from = referencePoint(object.from, state);
    return { ...object, delta: coordinate(object.delta, key, value - from[key === "x" ? 0 : 1]) };
  }
  if (part) {
    const ref = targetReference(target);
    return ref ? replaceReference(object, part, writeReference(state, ref, key, value)) : object;
  }
  if (object.type === "track" && key === "rounding" && typeof value === "number") return { ...object, rounding: value };
  if (object.type === "track" && part === "point" && index !== undefined && typeof value === "number") {
    return writeSegment(object, index, key, value);
  }
  if (object.type === "track" && (key === "ground" || key === "groundStyle" || key === "groundSide" || key === "groundDepth")) {
    return writeGround(object, key, value);
  }
  if (object.type === "block") {
    if ((key === "width" || key === "height") && typeof value === "number") return { ...object, [key]: value };
    if (key === "fill" && (value === "paper" || value === "shade")) return { ...object, fill: value };
    if (key === "track" && typeof value === "string") {
      const current = state.poses.get(object.id);
      if (!current) return object;
      /* 자유 배치로 풀 때 현재 접촉점과 접선 회전을 유지한다. */
      if (value === "free") return { ...object, pose: { mode: "free", point: [...current.point], angle: current.angle } };
      const trackId = value.startsWith("track:") ? value.slice("track:".length) : undefined;
      const points = trackId && state.tracks.get(trackId);
      if (!points) return object;
      const nearest = nearestOnTrack(points, current.point);
      return { ...object, pose: { mode: "track", track: trackId, t: nearest.t, offset: 0 } };
    }
    const pose = object.pose;
    if (pose.mode === "free" && typeof value === "number") {
      if (key === "angle") return { ...object, pose: { ...pose, angle: value } };
      if (key === "x" || key === "y") return { ...object, pose: { ...pose, point: coordinate(pose.point, key, value) } };
    }
    if (pose.mode === "track" && (key === "t" || key === "offset") && typeof value === "number") {
      /* 패널만 백분율이다. JSON의 t는 기존 0..1 호 길이 비율을 계속 저장한다. */
      return { ...object, pose: { ...pose, [key]: key === "t" ? value / 100 : value } };
    }
  }
  if (object.type === "force" && (key === "deltaX" || key === "deltaY") && typeof value === "number") {
    return { ...object, delta: coordinate(object.delta, key === "deltaX" ? "x" : "y", value) };
  }
  if (object.type === "force" && (key === "magnitude" || key === "direction") && typeof value === "number") {
    const length = key === "magnitude" ? value : Math.hypot(object.delta[0], object.delta[1]);
    const degrees = key === "direction" ? value : Math.atan2(object.delta[1], object.delta[0]) * 180 / Math.PI;
    const radians = degrees * Math.PI / 180;
    return { ...object, delta: [Math.cos(radians) * length, Math.sin(radians) * length] };
  }
  if (object.type === "force" && key === "angleMark" && typeof value === "boolean") {
    return value ? { ...object, angleMark: object.angleMark ?? { reference: "horizontal", auto: true } } : { ...object, angleMark: undefined };
  }
  const motion = writeMotion(state, object, key, value);
  if (motion) return motion;
  if (object.type === "dimension") {
    if (key === "axis" && (value === "horizontal" || value === "vertical")) return { ...object, axis: value };
    if (key === "offset" && typeof value === "number") return { ...object, offset: value };
  }
  if (object.type === "support" && typeof value === "number") {
    if (key === "x" || key === "y") return { ...object, point: coordinate(object.point, key, value) };
    if (key === "width" || key === "height" || key === "angle") return { ...object, [key]: value };
  }
  if (object.type === "spring" && (key === "width" || key === "coils") && typeof value === "number") return { ...object, [key]: value };
  if (object.type === "rope") {
    if (key === "wrap" && (value === "cw" || value === "ccw")) return { ...object, wrap: value };
    if (key === "pulley" && typeof value === "string") {
      if (value === "none") {
        /* 경유를 지워도 양 끝 연결과 마지막 감는 방향은 보존한다. */
        const { pulley: _pulley, ...straight } = object;
        return straight;
      }
      const id = value.startsWith("pulley:") ? value.slice("pulley:".length) : undefined;
      if (id && state.byId.get(id)?.type === "pulley") return { ...object, pulley: id };
    }
  }
  const [slot, referenceKey] = key.split(".");
  if (!slot || !referenceKey) return object;
  const ref = targetReference({ object, part: slot });
  return ref ? replaceReference(object, slot, writeReference(state, ref, referenceKey, value)) : object;
}

function coordinate(point: Vec, key: string, value: number): Vec {
  return key === "x" ? [value, point[1]] : key === "y" ? [point[0], value] : point;
}

function writeReference(state: MechanicsState, ref: PointRef, key: string, value: FieldPatch["value"]): PointRef {
  if (key === "target" && typeof value === "string") {
    /* 연결을 해제할 때 기준점의 실제 위치를 보존해 화살표·치수선이 튀지 않게 한다. */
    if (value === "free") return { mode: "free", point: referencePoint(ref, state) };
    const [type, id, extra] = value.split(":");
    if (value.startsWith("vertex:")) {
      const [, track, index] = value.split(":");
      const n = Number(index);
      const owner = track ? state.byId.get(track) : undefined;
      if (owner?.type === "track" && Number.isInteger(n) && owner.points[n]) return { mode: "vertex", track, index: n };
    }
    if (!extra && id && (type === "block" || type === "pulley" || type === "support" || type === "ball" || type === "point" || type === "trajectory") && state.byId.get(id)?.type === type) {
      const anchor = type === "trajectory" ? "start" : "center";
      return { mode: "anchor", object: id, anchor };
    }
  }
  if (ref.mode === "free" && (key === "x" || key === "y") && typeof value === "number") {
    return { ...ref, point: coordinate(ref.point, key, value) };
  }
  if (ref.mode === "vertex" && (key === "offsetX" || key === "offsetY") && typeof value === "number") {
    return { ...ref, offset: coordinate(ref.offset ?? [0, 0], key === "offsetX" ? "x" : "y", value) };
  }
  if (ref.mode === "anchor") {
    if (key === "anchor" && (value === "center" || value === "top" || value === "bottom" || value === "left" || value === "right" || value === "start" || value === "end" || value === "apex")) {
      return { ...ref, anchor: value };
    }
    if ((key === "offsetX" || key === "offsetY") && typeof value === "number") {
      return { ...ref, offset: coordinate(ref.offset ?? [0, 0], key === "offsetX" ? "x" : "y", value) };
    }
  }
  return ref;
}

function writeStroke(object: MechanicsObject, value: string): MechanicsObject {
  if (value === "solid") return { ...object, dashed: false, dash: undefined };
  if (value === "dash") return { ...object, dashed: true, dash: "dash" };
  if (value === "dot") return { ...object, dashed: true, dash: "dot" };
  return object;
}

function writeWeight(object: MechanicsObject, value: string): MechanicsObject {
  if (value === "auto") {
    const { weight: _weight, ...rest } = object;
    return rest;
  }
  if (value === "thin" || value === "normal" || value === "bold") return { ...object, weight: value };
  return object;
}

function writeGround(object: Extract<MechanicsObject, { type: "track" }>, key: string, value: FieldPatch["value"]): MechanicsObject {
  if (key === "ground" && typeof value === "boolean") {
    return value ? { ...object, ground: object.ground ?? { style: "shade", side: "below", depth: 3 } } : { ...object, ground: undefined };
  }
  if (!object.ground) return object;
  if (key === "groundStyle" && (value === "shade" || value === "hatch")) return { ...object, ground: { ...object.ground, style: value } };
  if (key === "groundSide" && (value === "below" || value === "above" || value === "left" || value === "right")) {
    return { ...object, ground: { ...object.ground, side: value } };
  }
  if (key === "groundDepth" && typeof value === "number") return { ...object, ground: { ...object.ground, depth: value } };
  return object;
}

function writeSegment(object: Extract<MechanicsObject, { type: "track" }>, index: number, key: string, value: number): MechanicsObject {
  const prev = object.points[index - 1];
  const current = object.points[index];
  if (!prev || !current) return object;
  const length = key === "segmentLength" ? value : Math.hypot(current[0] - prev[0], current[1] - prev[1]);
  const degrees = key === "segmentAngle" ? value : Math.atan2(current[1] - prev[1], current[0] - prev[0]) * 180 / Math.PI;
  const radians = degrees * Math.PI / 180;
  const next: Vec = [prev[0] + Math.cos(radians) * length, prev[1] + Math.sin(radians) * length];
  return { ...object, points: object.points.map((point, at) => at === index ? next : point) };
}

function writeMotion(state: MechanicsState, object: MechanicsObject, key: string, value: FieldPatch["value"]): MechanicsObject | undefined {
  if (object.type === "ball") {
    if (key === "radius" && typeof value === "number") return { ...object, radius: value };
    if (key === "fill" && (value === "paper" || value === "shade" || value === "ink")) return { ...object, fill: value };
    if (key === "track" && typeof value === "string") {
      const ball = state.balls.get(object.id);
      if (!ball) return object;
      if (value === "free") return { ...object, pose: { mode: "free", point: [...ball.center] } };
      const id = value.startsWith("track:") ? value.slice(6) : undefined;
      const points = id ? state.tracks.get(id) : undefined;
      if (!id || !points) return object;
      return { ...object, pose: { mode: "track", track: id, t: nearestOnTrack(points, ball.center).t, offset: 0 } };
    }
    if (object.pose.mode === "free" && (key === "x" || key === "y") && typeof value === "number") {
      return { ...object, pose: { ...object.pose, point: coordinate(object.pose.point, key, value) } };
    }
    if (object.pose.mode === "track" && (key === "t" || key === "offset") && typeof value === "number") {
      return { ...object, pose: { ...object.pose, [key]: key === "t" ? value / 100 : value } };
    }
  }
  if (object.type === "trajectory") {
    if (key === "angle" && typeof value === "number") return { ...object, angle: value };
    if (key === "arrowCount" && typeof value === "number") {
      const count = Math.max(0, Math.min(3, Math.round(value)));
      const arrows = count === 0 ? [] : Array.from({ length: count }, (_, index) => (index + 1) / (count + 1));
      return { ...object, arrows };
    }
    if (key === "launch" && typeof value === "boolean") return { ...object, launch: value ? object.launch ?? { length: 6, label: "$v_0$" } : undefined };
    if (key === "launchAngle" && typeof value === "boolean") return { ...object, launchAngle: value ? object.launchAngle ?? { auto: true, reference: true } : undefined };
    if (key === "arrival" && typeof value === "boolean") return { ...object, arrival: value ? object.arrival ?? { length: 6, label: "$v$" } : undefined };
    if (key === "apex" && typeof value === "boolean") return { ...object, apex: value ? object.apex ?? { drop: true, label: "최고점" } : undefined };
  }
  if (object.type === "angle") {
    if (key === "mark" && (value === "arc" || value === "right")) return { ...object, mark: value };
    if (key === "auto" && typeof value === "boolean") return { ...object, auto: value };
  }
  if (object.type === "point" && object.at.mode === "free" && (key === "x" || key === "y") && typeof value === "number") {
    return { ...object, at: { ...object.at, point: coordinate(object.at.point, key, value) } };
  }
  return undefined;
}

function replaceReference(object: MechanicsObject, slot: string, ref: PointRef): MechanicsObject {
  if (object.type === "force" && slot === "from") return { ...object, from: ref };
  if ((object.type === "dimension" || object.type === "guide" || object.type === "spring" || object.type === "rope") && (slot === "a" || slot === "b")) return { ...object, [slot]: ref };
  if (object.type === "label" && slot === "at") return { ...object, at: ref };
  return object;
}
