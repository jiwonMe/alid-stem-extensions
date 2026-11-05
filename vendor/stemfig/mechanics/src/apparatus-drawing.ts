/**
 * 용수철·실·도르래·받침대의 인쇄 기호를 DisplayList로 바꾼다.
 * 연결점과 감김 경로는 init이 이미 해석했으므로 여기서는 힘이나 길이 제약을 풀지 않는다.
 * 고정 mm 해칭·축 표시만 소유하며 Grida나 앱의 상태를 참조하지 않는다.
 */
import { DEFAULT_SHEET_FILL, type DisplayItem } from "@stemfig/display";
import type { CompileCtx } from "@stemfig/host";
import { supportCorners } from "./apparatus-geometry.ts";
import { strokePath } from "./drawing.ts";
import type { MechanicsState } from "./init.ts";
import { inkWidth, SUPPORT_FILL } from "./print-style.ts";
import type { MechanicsObject, Vec } from "./schema.ts";
import { baseHatches } from "./terrain-drawing.ts";

type ApparatusObject = Extract<MechanicsObject, { type: "spring" | "rope" | "pulley" | "support" }>;

/* 도르래 축은 인쇄상 식별 표시다. 최대 반지름 0.45mm이며 작은 바퀴 안으로 제한한다. */
const AXLE_RADIUS_MM = 0.45;

/**
 * 기구 객체 한 개를 페이지 좌표로 투영한다.
 * @param ctx 봉투 투영과 상속 스타일
 * @param state 검증된 용수철·실 경로 캐시
 * @param object 기구 객체. 숨김 판정은 compile 호출 측이 담당한다
 * @param page 장면 y-up 좌표를 페이지 mm로 바꾸는 함수
 * @returns 새 DisplayItem 목록. 해석 경로가 없으면 빈 목록이며 원본을 수정하지 않는다
 */
export function drawApparatus(ctx: CompileCtx, state: MechanicsState, object: ApparatusObject, page: (x: number, y: number) => Vec): DisplayItem[] {
  const { style } = ctx;
  switch (object.type) {
    case "spring":
    case "rope": return strokePath((state.paths.get(object.id) ?? []).map((point) => page(...point)), style, object.dashed, inkWidth(style, "body", object.weight), object.dash === "dot" ? "dot" : "dash");
    case "pulley": {
      const [cx, cy] = page(...object.center);
      const rx = Math.abs(page(object.center[0] + object.radius, object.center[1])[0] - cx);
      const ry = Math.abs(page(object.center[0], object.center[1] + object.radius)[1] - cy);
      /* stretch에서는 원을 억지로 유지하지 않는다. 실과 같은 투영을 적용한 타원이 된다. */
      const rim: DisplayItem = { op: "ellipse", cx, cy, rx, ry, stroke: style.stroke,
        fill: DEFAULT_SHEET_FILL, width: object.dashed ? 0 : inkWidth(style, "body", object.weight) };
      const items: DisplayItem[] = [rim];
      if (object.dashed) items.push(...strokePath(circlePoints(cx, cy, rx, ry), style, true, inkWidth(style, "body", object.weight), object.dash === "dot" ? "dot" : "dash"));
      items.push({ op: "circle", cx, cy, r: Math.min(AXLE_RADIUS_MM, rx / 5, ry / 5),
        stroke: style.stroke, fill: style.stroke, width: 0 });
      return items;
    }
    case "support": {
      const points = supportCorners(object).map((point) => page(...point));
      const triangle: DisplayItem = { op: "polygon", points, stroke: style.stroke,
        fill: SUPPORT_FILL, width: object.dashed ? 0 : inkWidth(style, "body", object.weight) };
      const items: DisplayItem[] = [triangle];
      if (object.dashed) items.push(...strokePath([...points, points[0]!], style, true, inkWidth(style, "body", object.weight), object.dash === "dot" ? "dot" : "dash"));
      items.push(...baseHatches(points, ctx));
      return items;
    }
  }
}

function circlePoints(cx: number, cy: number, rx: number, ry: number): Vec[] {
  /* 기존 교과 점선 원과 같은 현 오차 0.02mm를 지킨다. 원 둘레만 샘플링한다. */
  const count = Math.max(24, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - 0.02 / Math.max(rx, ry, 0.02)))));
  return Array.from({ length: count + 1 }, (_, index): Vec => {
    const angle = index / count * Math.PI * 2;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

