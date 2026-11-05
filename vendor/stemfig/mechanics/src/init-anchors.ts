/**
 * 연결점을 장면 좌표로 푼다.
 * 단계 순서는 init 이 지키고, 여기서는 이미 있는 파생 좌표만 읽는다.
 * 없는 종류에 start·apex 를 붙이면 UNKNOWN_REF 다. 호스트는 이 표를 모른다.
 */
import { stemfigError } from "@stemfig/host";
import { supportCorners } from "./apparatus-geometry.ts";
import { blockCorners } from "./geometry.ts";
import type { MechanicsState } from "./init.ts";
import { apexPoint } from "./projectile-geometry.ts";
import type { PointRef, Vec } from "./schema.ts";

/**
 * 자유점·연결점·꼭짓점을 장면 좌표로 변환한다.
 * @param ref 동일 figure 내부의 참조. offset 은 회전과 무관한 장면 델타
 * @param state init 이 앞 단계까지 채운 조회표
 * @returns 새 좌표. 객체와 원본 참조를 변경하지 않는다
 * @throws 객체가 없거나 그 종류에 없는 연결점이면 UNKNOWN_REF
 */
export function referencePoint(ref: PointRef, state: MechanicsState): Vec {
  if (ref.mode === "free") return [...ref.point];
  if (ref.mode === "vertex") return vertexPoint(ref, state);
  const point = anchorPoint(ref, state);
  const offset = ref.offset ?? [0, 0];
  return [point[0] + offset[0], point[1] + offset[1]];
}

function vertexPoint(ref: Extract<PointRef, { mode: "vertex" }>, state: MechanicsState): Vec {
  const track = state.byId.get(ref.track);
  const point = track?.type === "track" ? track.points[ref.index] : undefined;
  if (!point) {
    throw stemfigError("UNKNOWN_REF", "reference.track", `unknown track vertex ${ref.track}:${ref.index}`);
  }
  const offset = ref.offset ?? [0, 0];
  return [point[0] + offset[0], point[1] + offset[1]];
}

function anchorPoint(ref: Extract<PointRef, { mode: "anchor" }>, state: MechanicsState): Vec {
  const object = state.byId.get(ref.object);
  const pose = state.poses.get(ref.object);
  if (object?.type === "block" && pose) return boxAnchor(object, pose, ref.anchor);
  if (object?.type === "ball") return ballAnchor(ref, state);
  if (object?.type === "point") return pointAnchor(ref, state);
  if (object?.type === "trajectory") return trajectoryAnchor(ref, state);
  if (object?.type === "pulley") return named(pulleyAnchors(object), ref.anchor, ref.object);
  if (object?.type === "support") return named(supportAnchors(object), ref.anchor, ref.object);
  throw stemfigError("UNKNOWN_REF", "reference.object", `unknown attachment object ${ref.object}`);
}

function named(anchors: Partial<Record<Extract<PointRef, { mode: "anchor" }>["anchor"], Vec>>, anchor: Extract<PointRef, { mode: "anchor" }>["anchor"], id: string): Vec {
  const point = anchors[anchor];
  if (!point) throw stemfigError("UNKNOWN_REF", "reference.anchor", `unknown anchor ${anchor} on ${id}`);
  return point;
}

function boxAnchor(block: Extract<import("./schema.ts").MechanicsObject, { type: "block" }>, pose: { point: Vec; angle: number }, anchor: Extract<PointRef, { mode: "anchor" }>["anchor"]): Vec {
  const [bottomLeft, bottomRight, topRight, topLeft] = blockCorners(block, pose) as [Vec, Vec, Vec, Vec];
  return named({
    bottom: [...pose.point], top: middle(topLeft, topRight), left: middle(bottomLeft, topLeft),
    right: middle(bottomRight, topRight), center: middle(bottomLeft, topRight),
  }, anchor, block.id);
}

function ballAnchor(ref: Extract<PointRef, { mode: "anchor" }>, state: MechanicsState): Vec {
  const ball = state.balls.get(ref.object);
  if (!ball) throw stemfigError("UNKNOWN_REF", "reference.object", `unknown ball ${ref.object}`);
  const [x, y] = ball.center;
  const r = ball.radius;
  return named({ center: [x, y], top: [x, y + r], bottom: [x, y - r], left: [x - r, y], right: [x + r, y] }, ref.anchor, ref.object);
}

function pointAnchor(ref: Extract<PointRef, { mode: "anchor" }>, state: MechanicsState): Vec {
  const at = state.markers.get(ref.object);
  if (!at) throw stemfigError("UNKNOWN_REF", "reference.object", `unknown point ${ref.object}`);
  return named({ center: at }, ref.anchor, ref.object);
}

function trajectoryAnchor(ref: Extract<PointRef, { mode: "anchor" }>, state: MechanicsState): Vec {
  const flight = state.curves.get(ref.object);
  if (!flight) throw stemfigError("UNKNOWN_REF", "reference.object", `unknown trajectory ${ref.object}`);
  return named({ start: [...flight.a], end: [...flight.b], apex: apexPoint(flight) }, ref.anchor, ref.object);
}

function pulleyAnchors(object: Extract<import("./schema.ts").MechanicsObject, { type: "pulley" }>): Partial<Record<string, Vec>> {
  const [x, y] = object.center;
  const r = object.radius;
  return { center: [x, y], top: [x, y + r], bottom: [x, y - r], left: [x - r, y], right: [x + r, y] };
}

function supportAnchors(object: Extract<import("./schema.ts").MechanicsObject, { type: "support" }>): Partial<Record<string, Vec>> {
  const [top, left, right] = supportCorners(object) as [Vec, Vec, Vec];
  const bottom = middle(left, right);
  return { top, bottom, left, right, center: middle(top, bottom) };
}

function middle(a: Vec, b: Vec): Vec {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
