/**
 * physics.mechanics@1의 정적 역학 작도 문법.
 * 좌표는 봉투 view의 y-up 단위이며 물리량이나 운동을 계산하지 않는다.
 * 부착 관계의 해석은 이 플러그인 안에서만 한다. 호스트와 앱은 spec을 열지 않는다.
 */
import { z } from "zod";
import { angleMarkSchema, apexPartSchema, groundSchema, launchAngleSchema, velocityPartSchema } from "./schema-parts.ts";
import { idSchema, pointSchema, raySchema, referenceSchema, type PointRef, type RayRef } from "./schema-refs.ts";

const finite = z.number().finite();
const poseSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("free"), point: pointSchema, angle: finite }),
  z.object({ mode: z.literal("track"), track: idSchema, t: finite.min(0).max(1), offset: finite }),
]);
const ballPoseSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("free"), point: pointSchema }),
  z.object({ mode: z.literal("track"), track: idSchema, t: finite.min(0).max(1), offset: finite }),
]);
const common = {
  id: idSchema,
  label: z.string().optional(),
  /* 글자 크기는 페이지 mm다. 없으면 호스트 기본값을 상속하고 장면 배율과 분리한다. */
  labelSize: finite.positive().optional(),
  /* 이전 위치를 포함한 인쇄 표현이다. 물리적 상태나 시간은 저장하지 않는다. */
  dashed: z.boolean().optional(),
  /* dashed 가 켜졌을 때의 무늬. 없으면 기존 1.2/0.8 점선이다. */
  dash: z.enum(["dash", "dot"]).optional(),
  /* 역할 선폭을 덮는다. 없으면 print-style 의 역할 배율이다. */
  weight: z.enum(["thin", "normal", "bold"]).optional(),
  show: z.boolean().optional(),
  /* 라벨 간격만 최종 페이지 mm다. 장면을 축소해도 글자와의 간격을 보존한다. */
  labelOffset: pointSchema.optional(),
};
const objectSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("track"), points: z.array(pointSchema).min(2), rounding: finite.nonnegative(), ground: groundSchema.optional() }),
  z.object({ ...common, type: z.literal("block"), width: finite.positive(), height: finite.positive(), pose: poseSchema, fill: z.enum(["paper", "shade"]).optional() }),
  z.object({ ...common, type: z.literal("ball"), radius: finite.positive(), fill: z.enum(["paper", "shade", "ink"]), pose: ballPoseSchema }),
  z.object({ ...common, type: z.literal("point"), at: referenceSchema }),
  z.object({
    ...common, type: z.literal("trajectory"), a: referenceSchema, b: referenceSchema,
    angle: finite.gt(-89).lt(89), arrows: z.array(finite.min(0).max(1)).max(3),
    launch: velocityPartSchema.optional(), arrival: velocityPartSchema.optional(),
    launchAngle: launchAngleSchema.optional(), apex: apexPartSchema.optional(),
  }),
  z.object({
    ...common, type: z.literal("angle"), v: referenceSchema, a: raySchema, b: raySchema,
    mark: z.enum(["arc", "right"]), auto: z.boolean(), radius: finite.positive().optional(),
  }),
  z.object({ ...common, type: z.literal("spring"), a: referenceSchema, b: referenceSchema,
    width: finite.positive(), coils: finite.int().min(2).max(40) }),
  z.object({ ...common, type: z.literal("pulley"), center: pointSchema, radius: finite.positive() }),
  z.object({ ...common, type: z.literal("support"), point: pointSchema,
    width: finite.positive(), height: finite.positive(), angle: finite }),
  z.object({ ...common, type: z.literal("rope"), a: referenceSchema, b: referenceSchema,
    pulley: idSchema.optional(), wrap: z.enum(["cw", "ccw"]) }),
  z.object({ ...common, type: z.literal("force"), from: referenceSchema, delta: pointSchema, angleMark: angleMarkSchema.optional() }),
  z.object({ ...common, type: z.literal("dimension"), a: referenceSchema, b: referenceSchema,
    axis: z.enum(["horizontal", "vertical"]), offset: finite }),
  z.object({ ...common, type: z.literal("guide"), a: referenceSchema, b: referenceSchema }),
  z.object({ ...common, type: z.literal("label"), at: referenceSchema }),
]);

export type { Vec, PointRef, RayRef } from "./schema-refs.ts";
export type { GroundFill, VelocityPart, LaunchAnglePart, ApexPart, AngleMark } from "./schema-parts.ts";
/** 자유 배치와 경로 부착은 배타적이다. 계산한 좌표를 JSON에 중복 저장하지 않는다. */
export type BlockPose = z.infer<typeof poseSchema>;
/** 공의 중심. 경로에 붙이면 바닥이 표면에 닿도록 init 이 반지름만큼 띄운다. */
export type BallPose = z.infer<typeof ballPoseSchema>;
/** 역학 작도 객체. 그리기 명령으로 변환하는 책임은 compile에 있다. */
export type MechanicsObject = z.infer<typeof objectSchema>;
/** 경로 객체. 끝점 순서가 부착 위치 t의 방향을 결정한다. */
export type Track = Extract<MechanicsObject, { type: "track" }>;
/** 물체 객체. pose.point는 무게중심이 아닌 바닥 중앙이다. */
export type Block = Extract<MechanicsObject, { type: "block" }>;
/** 공. radius 는 장면 단위다. */
export type Ball = Extract<MechanicsObject, { type: "ball" }>;
/** 이름 있는 점. */
export type MarkPoint = Extract<MechanicsObject, { type: "point" }>;
/** 시작·끝·발사각으로만 정하는 곡선. v0 와 g 는 없다. */
export type Trajectory = Extract<MechanicsObject, { type: "trajectory" }>;
/** 호 또는 직각. auto 면 측정 각도를 라벨로 쓴다. */
export type AngleMarkObject = Extract<MechanicsObject, { type: "angle" }>;
/** 양 끝점과 코일 외형만 저장하는 용수철. 권수 2..40은 편집·출력 복잡도 제한이다. */
export type Spring = Extract<MechanicsObject, { type: "spring" }>;
/** 중심과 반지름을 가진 도르래. 질량·관성·축 반력은 저장하지 않는다. */
export type Pulley = Extract<MechanicsObject, { type: "pulley" }>;
/** point가 꼭짓점인 삼각 받침대. angle은 y-up 반시계 방향 도 단위다. */
export type Support = Extract<MechanicsObject, { type: "support" }>;
/** 직선 실 또는 도르래 한 개를 경유하는 실. 길이 보존 조건은 계산하지 않는다. */
export type Rope = Extract<MechanicsObject, { type: "rope" }>;

/**
 * 호스트가 호출하는 유일한 spec 구조 검증기. 참조 검증은 init에서 수행한다.
 * draft는 도구 진행 상태이며 compile은 완성 객체만 출력한다.
 */
export const mechanicsSpecSchema = z.object({
  objects: z.array(objectSchema),
  draft: z.object({
    tool: z.enum(["track", "ground", "force", "dimension", "guide", "spring", "pulley", "rope", "trajectory", "angle"]),
    points: z.array(pointSchema).min(1),
    from: referenceSchema.optional(),
    pulley: idSchema.optional(),
    vertex: referenceSchema.optional(),
    ray: raySchema.optional(),
    angle: finite.optional(),
  }).optional(),
});
/** 직렬화 가능한 작도 원본. 파생 좌표·캐시·undo 스택은 포함하지 않는다. */
export type MechanicsSpec = z.infer<typeof mechanicsSpecSchema>;

/**
 * 접선이 아닌 변만 연결점 목록에 넣는다.
 * @param ray 각의 한 변
 * @returns 점 참조. 접선이면 undefined
 */
export function pointRay(ray: RayRef): PointRef | undefined {
  return ray.mode === "tangent" ? undefined : ray;
}
