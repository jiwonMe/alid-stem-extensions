/**
 * 객체별 그림 스타일. 기본값은 호스트의 ResolvedStyle 에서 받고 명시된 값만 덮는다.
 * 점선은 페이지 mm 선 토막으로 출력하여 SVG 와 Grida 가 같은 DisplayList 를 그린다.
 */
import type { DisplayItem, ResolvedStyle } from "@stemfig/display";
import { splitDash } from "@stemfig/plugin-kit";
import { z } from "zod";

/** 객체·각·변 마크가 공유하는 선택 스타일. 최상위 spec 스타일은 만들지 않는다. */
export const paintShape = {
  /* UI 색상 컨트롤의 RGB 계약. CSS 함수나 SVG 참조값은 허용하지 않는다. */
  stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  strokeWidth: z.number().finite().positive().optional(),
  lineStyle: z.enum(["solid", "dashed"]).optional(),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  labelSize: z.number().finite().positive().optional(),
};

/** 객체에 저장되는 선택 오버라이드. 단위는 모두 페이지 mm. */
export type ObjectPaint = z.infer<z.ZodObject<typeof paintShape>>;

/** @param base 호스트의 상속 스타일 @param paint 객체 스타일 @returns 합성 스타일 */
export function resolvePaint(base: ResolvedStyle, paint: ObjectPaint): ResolvedStyle {
  return {
    stroke: paint.stroke ?? base.stroke,
    width: paint.strokeWidth ?? base.width,
    textSize: paint.labelSize ?? base.textSize,
    textFill: paint.stroke ?? base.textFill,
  };
}

/**
 * fill 과 점선을 최종 그림에 적용한다. 문자·그룹은 의미를 보존한다.
 * @param items 객체 한 개의 DisplayList
 * @param paint 직렬화된 객체 스타일
 * @returns SVG/Grida 양쪽이 직접 소비하는 도형. 입력은 바꾸지 않는다
 */
export function paintItems(items: DisplayItem[], paint: ObjectPaint): DisplayItem[] {
  return items.flatMap((item): DisplayItem[] => {
    if (item.op === "text" || item.op === "glyphs" || item.op === "group") return [item];
    const next = { ...item, ...(paint.strokeWidth === undefined ? {} : { width: paint.strokeWidth }) };
    if (next.op !== "polyline" && paint.fill) next.fill = paint.fill;
    if (paint.lineStyle !== "dashed") return [next];
    const points = outline(next);
    const strokes: DisplayItem[] = dash(points, next.width).map((part) => ({ op: "polyline", points: part, stroke: next.stroke, width: next.width }));
    /* 채움은 연속 도형 한 번, 외곽만 점선. width 0 은 양 렌더러의 무테 계약이다. */
    return next.op !== "polyline" && next.fill ? [{ ...next, width: 0 }, ...strokes] : strokes;
  });
}

type StrokeItem = Exclude<DisplayItem, { op: "text" | "glyphs" | "group" }>;
type Pair = [number, number];

function outline(item: StrokeItem): Pair[] {
  if (item.op === "polyline" || item.op === "polygon") {
    return (item.op === "polygon" || item.close) && item.points[0] ? [...item.points, item.points[0]] : item.points;
  }
  const rx = item.op === "circle" ? item.r : item.rx;
  const ry = item.op === "circle" ? item.r : item.ry;
  /* 원의 현 오차를 0.02mm 이하로 제한한다. 인쇄 선폭보다 작으며 화면과 SVG 에 공통이다. */
  const count = Math.max(24, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - 0.02 / Math.max(rx, ry, 0.02)))));
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return [item.cx + Math.cos(angle) * rx, item.cy + Math.sin(angle) * ry];
  });
}

function dash(points: Pair[], width: number): Pair[][] {
  /* 교재 보조선: 최소 1.2mm 선 + 0.8mm 공백. 굵은 선에서는 선폭 비율로 늘린다. */
  return splitDash(points, Math.max(1.2, width * 6), Math.max(0.8, width * 4));
}
