/**
 * figure.grid / figure.axes Zod.
 * 교과를 모른다. 양수·색만 검사한다. spec 안의 grid 는 여기 없다.
 */
import { z } from "zod";
import type { Axes, Grid, Ticks } from "@stemfig/display";
import { nodeColorSchema } from "./color.ts";

const strokeWidth = z.number().positive().max(2);

/**
 * 격자 한 덩어리. 빈 객체는 기본값으로 켠다.
 */
export const gridSchema: z.ZodType<Grid> = z
  .object({
    show: z.boolean().optional(),
    stepX: z.number().positive().optional(),
    stepY: z.number().positive().optional(),
    minor: z.boolean().optional(),
    subdivisions: z.number().int().min(2).max(10).optional(),
    stroke: nodeColorSchema.optional(),
    width: strokeWidth.optional(),
    minorStroke: nodeColorSchema.optional(),
    minorWidth: strokeWidth.optional(),
  })
  .strict();

const ticksSchema: z.ZodType<Ticks> = z
  .object({
    show: z.boolean().optional(),
    stepX: z.number().positive().optional(),
    stepY: z.number().positive().optional(),
    labels: z.boolean().optional(),
    minor: z.boolean().optional(),
    subdivisions: z.number().int().min(2).max(10).optional(),
  })
  .strict();

const axisSchema = z
  .object({
    show: z.boolean().optional(),
    label: z.string().max(40).optional(),
    stroke: nodeColorSchema.optional(),
    width: strokeWidth.optional(),
  })
  .strict();

/**
 * 축 쌍. ticks 는 x/y 공용.
 */
export const axesSchema: z.ZodType<Axes> = z
  .object({
    show: z.boolean().optional(),
    x: axisSchema.optional(),
    y: axisSchema.optional(),
    stroke: nodeColorSchema.optional(),
    width: strokeWidth.optional(),
    ticks: ticksSchema.optional(),
    arrows: z.boolean().optional(),
    origin: z.boolean().optional(),
    originLabel: z.string().max(40).optional(),
  })
  .strict();
