/**
 * 역학 작도의 연결점 문법.
 * 좌표는 장면 y-up 이다. 어느 객체가 그 연결을 가질 수 있는지는 init 이 가른다.
 * 호스트는 이 합집합을 열지 않는다.
 */
import { z } from "zod";

const finite = z.number().finite();
/*
 * describe 는 문법 출력(stemfig schema)이 쓰는 이름표다. 파싱 결과는 바꾸지 않는다.
 * 같은 합집합이 객체마다 펼쳐지지 않고 Vec·Id·PointRef·RayRef 로 한 번만 정의된다.
 */

/** 장면 좌표 한 점. 페이지 mm 로 바꾸기 전에만 쓴다. */
export const pointSchema = z.tuple([finite, finite]).describe("Vec");
/* ':'는 내부 손잡이 구분자다. 문서 figure id와 별개의 이름 공간을 사용한다. */
export const idSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/).describe("Id");

const anchorName = z.enum(["center", "top", "bottom", "left", "right", "start", "end", "apex"]).describe("AnchorName");

/**
 * 자유 좌표, 객체 연결점, 경로 꼭짓점.
 * start·end·apex 는 포물선만, center 는 점만 가진다. 잘못된 조합은 init 이 UNKNOWN_REF 로 거절한다.
 */
export const referenceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("free"), point: pointSchema }),
  z.object({
    mode: z.literal("anchor"),
    object: idSchema,
    anchor: anchorName,
    offset: pointSchema.optional(),
  }),
  z.object({
    mode: z.literal("vertex"),
    track: idSchema,
    index: z.number().int().nonnegative(),
    offset: pointSchema.optional(),
  }),
]).describe("PointRef");

/**
 * 각의 한 변. 점 참조이거나 포물선 끝의 접선이다.
 * 접선은 속도를 저장하지 않고 이미 해석된 곡선의 방향을 가리킨다.
 */
export const raySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("free"), point: pointSchema }),
  z.object({
    mode: z.literal("anchor"),
    object: idSchema,
    anchor: anchorName,
    offset: pointSchema.optional(),
  }),
  z.object({
    mode: z.literal("vertex"),
    track: idSchema,
    index: z.number().int().nonnegative(),
    offset: pointSchema.optional(),
  }),
  z.object({
    mode: z.literal("tangent"),
    trajectory: idSchema,
    end: z.enum(["start", "end"]),
  }),
]).describe("RayRef");

/** 페이지 크기에 의존하지 않는 장면 좌표 x,y 쌍. */
export type Vec = z.infer<typeof pointSchema>;
/** 연결점. 대상 종류가 맞는지 검증은 init 이 한다. */
export type PointRef = z.infer<typeof referenceSchema>;
/** 각의 변. tangent 는 점 참조가 아니다. */
export type RayRef = z.infer<typeof raySchema>;
