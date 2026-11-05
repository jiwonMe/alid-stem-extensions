/**
 * 역학 spec의 의존 관계를 고정 순서로 푼다.
 * 경로는 공보다, 공은 점보다, 점은 포물선보다, 포물선은 각·치수보다 먼저다.
 * 앞 단계만 참조할 수 있다. 파생 좌표는 캐시이며 물리 시뮬레이션을 하지 않는다.
 */
import { stemfigError } from "@stemfig/host";
import { ropePoints, springPoints } from "./apparatus-geometry.ts";
import { pointOnTrack, sampleTrack } from "./geometry.ts";
import { referencePoint } from "./init-anchors.ts";
import { solveFlight, type Flight } from "./projectile-geometry.ts";
import { pointRay, type Ball, type Block, type MechanicsObject, type MechanicsSpec, type PointRef, type RayRef, type Vec } from "./schema.ts";

/** 블록 바닥 중앙의 장면 좌표와 y-up 반시계 도 단위 각도. JSON에는 저장하지 않는다. */
export type ResolvedPose = { point: Vec; angle: number };
/** 공의 중심. 반지름은 장면 단위다. */
export type ResolvedBall = { center: Vec; radius: number };

/** 원본 spec과 렌더링·편집이 공유하는 파생 조회표. 호스트는 내부 필드를 읽지 않는다. */
export type MechanicsState = {
  spec: MechanicsSpec;
  byId: Map<string, MechanicsObject>;
  tracks: Map<string, Vec[]>;
  poses: Map<string, ResolvedPose>;
  balls: Map<string, ResolvedBall>;
  markers: Map<string, Vec>;
  curves: Map<string, Flight>;
  paths: Map<string, Vec[]>;
};

export { referencePoint } from "./init-anchors.ts";

/**
 * 검증된 spec에서 모든 부착 관계를 다시 계산한다.
 * @param spec mechanicsSpecSchema를 통과한 원본. 입력은 변경하지 않는다
 * @returns 경로·자세·곡선·연결점을 같은 좌표계에서 조회할 수 있는 상태
 * @throws 중복 id는 SPEC, 누락 참조는 UNKNOWN_REF, 닿지 않는 발사는 SPEC
 */
export function initMechanics(spec: MechanicsSpec): MechanicsState {
  const state: MechanicsState = {
    spec, byId: new Map(), tracks: new Map(), poses: new Map(), balls: new Map(),
    markers: new Map(), curves: new Map(), paths: new Map(),
  };
  for (const [index, object] of spec.objects.entries()) {
    if (state.byId.has(object.id)) {
      throw stemfigError("SPEC", `spec.objects.${index}.id`, `duplicate id ${object.id}`);
    }
    state.byId.set(object.id, object);
  }
  for (const object of spec.objects) {
    if (object.type === "track") state.tracks.set(object.id, sampleTrack(object));
  }
  for (const object of spec.objects) {
    if (object.type === "block") state.poses.set(object.id, resolvePose(object, state));
    if (object.type === "ball") state.balls.set(object.id, resolveBall(object, state));
  }
  for (const object of spec.objects) {
    if (object.type === "point") state.markers.set(object.id, referencePoint(object.at, state));
  }
  for (const object of spec.objects) {
    if (object.type !== "trajectory") continue;
    const a = referencePoint(object.a, state);
    const b = referencePoint(object.b, state);
    const flight = solveFlight(a, b, object.angle);
    if (!flight) {
      throw stemfigError("SPEC", `spec.objects.${object.id}.angle`, "발사 방향이 끝점보다 낮아 닿지 않습니다");
    }
    state.curves.set(object.id, flight);
  }
  for (const object of spec.objects) {
    for (const reference of referencesOf(object)) referencePoint(reference, state);
    if (object.type === "angle") validateRay(object.a, object.id, state), validateRay(object.b, object.id, state);
    if (object.type === "spring") state.paths.set(object.id,
      springPoints(referencePoint(object.a, state), referencePoint(object.b, state), object.width, object.coils));
    if (object.type === "rope") storeRope(object, state);
  }
  if (spec.draft?.from) referencePoint(spec.draft.from, state);
  if (spec.draft?.vertex) referencePoint(spec.draft.vertex, state);
  if (spec.draft?.ray) validateRay(spec.draft.ray, "draft", state);
  if (spec.draft?.pulley && state.byId.get(spec.draft.pulley)?.type !== "pulley") {
    throw stemfigError("UNKNOWN_REF", "spec.draft.pulley", `unknown pulley ${spec.draft.pulley}`);
  }
  return state;
}

function resolvePose(block: Block, state: MechanicsState): ResolvedPose {
  if (block.pose.mode === "free") return { point: [...block.pose.point], angle: block.pose.angle };
  const at = trackPoint(block.pose.track, block.pose.t, block.id, state);
  const angle = upright(at.angle);
  const radians = angle * Math.PI / 180;
  return { angle, point: [
    at.point[0] - Math.sin(radians) * block.pose.offset,
    at.point[1] + Math.cos(radians) * block.pose.offset,
  ] };
}

function resolveBall(ball: Ball, state: MechanicsState): ResolvedBall {
  if (ball.pose.mode === "free") return { center: [...ball.pose.point], radius: ball.radius };
  const at = trackPoint(ball.pose.track, ball.pose.t, ball.id, state);
  const angle = upright(at.angle);
  const radians = angle * Math.PI / 180;
  const lift = ball.radius + ball.pose.offset;
  return { radius: ball.radius, center: [
    at.point[0] - Math.sin(radians) * lift,
    at.point[1] + Math.cos(radians) * lift,
  ] };
}

function trackPoint(id: string, t: number, owner: string, state: MechanicsState): { point: Vec; angle: number } {
  const track = state.tracks.get(id);
  if (!track) throw stemfigError("UNKNOWN_REF", `spec.objects.${owner}.pose.track`, `unknown track ${id}`);
  return pointOnTrack(track, t);
}

function upright(angle: number): number {
  /* 경로를 오른쪽부터 그려도 물체는 지면 위쪽에 놓인다. 수직 경로는 왼쪽 면을 쓴다. */
  return angle > 90 ? angle - 180 : angle <= -90 ? angle + 180 : angle;
}

function storeRope(object: Extract<MechanicsObject, { type: "rope" }>, state: MechanicsState): void {
  const pulley = object.pulley ? state.byId.get(object.pulley) : undefined;
  if (object.pulley && pulley?.type !== "pulley") {
    throw stemfigError("UNKNOWN_REF", `spec.objects.${object.id}.pulley`, `unknown pulley ${object.pulley}`);
  }
  state.paths.set(object.id, ropePoints(referencePoint(object.a, state), referencePoint(object.b, state),
    object.wrap, pulley?.type === "pulley" ? pulley : undefined));
}

function validateRay(ray: RayRef, owner: string, state: MechanicsState): void {
  const point = pointRay(ray);
  if (point) {
    referencePoint(point, state);
    return;
  }
  if (ray.mode === "tangent" && !state.curves.has(ray.trajectory)) {
    throw stemfigError("UNKNOWN_REF", `spec.objects.${owner}.ray`, `unknown trajectory ${ray.trajectory}`);
  }
}

function referencesOf(object: MechanicsObject): PointRef[] {
  switch (object.type) {
    case "force": return [object.from];
    case "dimension":
    case "spring":
    case "rope":
    case "guide": return [object.a, object.b];
    case "label": return [object.at];
    case "point": return [object.at];
    case "trajectory": return [object.a, object.b];
    case "angle": return [object.v, pointRay(object.a), pointRay(object.b)].filter((item): item is PointRef => item !== undefined);
    default: return [];
  }
}
