/**
 * 정적 역학 장면을 페이지 mm DisplayList로 바꾼다.
 * 문서 순서 대신 채움·표면·궤적·물체·글자 레이어로 쌓아 흰 공이 궤적을 가리게 한다.
 * y-up 투영은 plugin-kit에 맡기고 힘·에너지·운동을 풀지 않는다.
 */
import { DEFAULT_SHEET_FILL, type DisplayItem } from "@stemfig/display";
import type { CompileCtx } from "@stemfig/host";
import { projectView } from "@stemfig/plugin-kit";
import { drawApparatus } from "./apparatus-drawing.ts";
import { arrowHead, arrowNotch, dimensionEnds, dimensionShaft, extensionLine, strokePath } from "./drawing.ts";
import { blockCorners } from "./geometry.ts";
import { referencePoint, type MechanicsState } from "./init.ts";
import { objectLabels } from "./labels.ts";
import { drawMark } from "./marks-drawing.ts";
import { BODY_FILL, inkWidth } from "./print-style.ts";
import { drawTrajectory, forceOrigin } from "./projectile-drawing.ts";
import type { MechanicsObject, Vec } from "./schema.ts";
import { groundBand } from "./terrain-drawing.ts";

/**
 * 완성된 객체만 레이어 순서로 그린다. draft는 도구 진행 상태라 출력에 넣지 않는다.
 * @param ctx 호스트 봉투의 frame·view와 상속 스타일
 * @param state init이 참조를 검증하고 위치를 해석한 장면
 * @returns 새 DisplayItem 배열. 빈 장면·숨김 객체는 출력이 없고 참조 오류는 init 계약 위반으로 전파한다
 */
export function compileMechanics(ctx: CompileCtx, state: MechanicsState): DisplayItem[] {
  const { toPage } = projectView(ctx, ctx.view);
  const layers: Record<"fill" | "surface" | "path" | "body" | "link" | "mark" | "dimension" | "label", DisplayItem[]> = {
    fill: [], surface: [], path: [], body: [], link: [], mark: [], dimension: [], label: [],
  };
  for (const object of state.spec.objects) {
    if (object.show === false) continue;
    paint(ctx, state, object, toPage, layers);
    for (const label of objectLabels(ctx, state, object)) {
      layers.label.push({ op: "text", x: label.x, y: label.y, text: label.text, size: label.size, fill: ctx.style.textFill });
    }
  }
  return [...layers.fill, ...layers.surface, ...layers.path, ...layers.body, ...layers.link, ...layers.mark, ...layers.dimension, ...layers.label];
}

function paint(ctx: CompileCtx, state: MechanicsState, object: MechanicsObject, toPage: (x: number, y: number) => Vec, layers: Record<string, DisplayItem[]>): void {
  const { style } = ctx;
  const look = object.dash === "dot" ? "dot" : "dash";
  switch (object.type) {
    case "spring":
    case "rope":
    case "pulley":
      layers.link!.push(...drawApparatus(ctx, state, object, toPage));
      return;
    case "support":
      layers.surface!.push(...drawApparatus(ctx, state, object, toPage));
      return;
    case "track": {
      const pagePoints = (state.tracks.get(object.id) ?? []).map((point) => toPage(...point));
      if (object.ground) layers.fill!.push(...groundBand(pagePoints, object.ground, style));
      layers.surface!.push(...strokePath(pagePoints, style, object.dashed, inkWidth(style, "surface", object.weight), look));
      return;
    }
    case "block": {
      const pose = state.poses.get(object.id);
      if (!pose) return;
      const points = blockCorners(object, pose).map((point) => toPage(...point));
      const fill = object.fill === "shade" ? BODY_FILL : DEFAULT_SHEET_FILL;
      const width = inkWidth(style, "body", object.weight);
      const polygon: DisplayItem = { op: "polygon", points, stroke: style.stroke, fill, width: object.dashed ? 0 : width };
      layers.body!.push(polygon);
      if (object.dashed && points[0]) layers.body!.push(...strokePath([...points, points[0]], style, true, width, look));
      return;
    }
    case "ball":
    case "point":
    case "angle":
      layers.mark!.push(...drawMark(object, toPage, style, state));
      return;
    case "trajectory":
      layers.path!.push(...drawTrajectory(ctx, state, object, toPage));
      return;
    case "force": {
      const start = forceOrigin(object.from, referencePoint(object.from, state), object.delta, state);
      const a = toPage(...start);
      const raw = referencePoint(object.from, state);
      const b = toPage(raw[0] + object.delta[0], raw[1] + object.delta[1]);
      const width = inkWidth(style, "arrow", object.weight);
      layers.mark!.push(...strokePath([a, arrowNotch(b, a)], style, object.dashed, width, look), ...arrowHead(b, a, style));
      return;
    }
    case "guide":
      layers.surface!.push(...strokePath([
        toPage(...referencePoint(object.a, state)), toPage(...referencePoint(object.b, state)),
      ], style, object.dashed ?? true, inkWidth(style, "guide", object.weight), look));
      return;
    case "dimension": {
      const [start, end] = dimensionEnds(object, state);
      const a = toPage(...start);
      const b = toPage(...end);
      const width = inkWidth(style, "guide", object.weight);
      const label = objectLabels(ctx, state, object).find((part) => part.id.endsWith(":label"));
      const left = arrowNotch(a, b);
      const right = arrowNotch(b, a);
      const extend = (from: Vec, to: Vec) => {
        const line = extensionLine(from, to);
        return line.length ? strokePath(line, style, object.dashed, width, look) : [];
      };
      layers.dimension!.push(
        ...extend(toPage(...referencePoint(object.a, state)), a),
        ...extend(toPage(...referencePoint(object.b, state)), b),
        ...dimensionShaft(left, right, label).flatMap((points) => strokePath(points, style, object.dashed, width, look)),
        ...arrowHead(a, b, style), ...arrowHead(b, a, style),
      );
      return;
    }
    case "label":
      return;
  }
}
