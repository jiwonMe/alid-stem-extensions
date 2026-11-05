/**
 * 포물선·각도·지면이 공유하는 선택 부품.
 * 길이는 주석이 없으면 장면 단위, 화살 길이와 라벨 간격만 페이지 mm 다.
 * 속도·중력·시간은 저장하지 않는다.
 */
import { z } from "zod";
import { pointSchema } from "./schema-refs.ts";

const finite = z.number().finite();

/** 경로 아래의 인쇄 채움. depth 는 페이지 mm 라 확대해도 띠 두께가 유지된다. */
export const groundSchema = z.object({
  style: z.enum(["shade", "hatch"]),
  side: z.enum(["below", "above", "left", "right"]),
  depth: finite.positive(),
});

/** 발사·도착 화살. length 는 페이지 mm. 라벨은 저자 표현이다. */
export const velocityPartSchema = z.object({
  length: finite.positive(),
  label: z.string().optional(),
  labelOffset: pointSchema.optional(),
});

/** 발사각 호. auto 가 켜지면 저장 각도를 도 라벨로 찍고 label 은 무시한다. */
export const launchAngleSchema = z.object({
  auto: z.boolean(),
  label: z.string().optional(),
  reference: z.boolean(),
  labelOffset: pointSchema.optional(),
});

/** 최고점 표시. drop 은 시작 높이까지의 수직 보조선이다. */
export const apexPartSchema = z.object({
  drop: z.boolean(),
  label: z.string().optional(),
  labelOffset: pointSchema.optional(),
});

/** 힘 화살표의 기준선 각도. 기준은 장면 수평·수직이다. */
export const angleMarkSchema = z.object({
  reference: z.enum(["horizontal", "vertical"]),
  auto: z.boolean(),
  label: z.string().optional(),
  labelOffset: pointSchema.optional(),
});

/** 지면 채움. */
export type GroundFill = z.infer<typeof groundSchema>;
/** 속도 화살 부품. */
export type VelocityPart = z.infer<typeof velocityPartSchema>;
/** 발사각 호 부품. */
export type LaunchAnglePart = z.infer<typeof launchAngleSchema>;
/** 최고점 부품. */
export type ApexPart = z.infer<typeof apexPartSchema>;
/** 힘 화살표 각도 표시. */
export type AngleMark = z.infer<typeof angleMarkSchema>;
