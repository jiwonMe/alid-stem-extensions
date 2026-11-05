/**
 * 객체 라벨과 부품 라벨의 페이지 baseline.
 * compile 과 HUD 가 같은 점을 쓴다. 글자 간격은 페이지 y-down mm 다.
 * 각도 숫자는 측정값이고 속도·높이를 계산해 넣지 않는다.
 */
import { measureLabelMm } from "@stemfig/display";
import { degreeTex, projectView } from "@stemfig/plugin-kit";
import type { CompileCtx } from "@stemfig/host";
import { supportCorners } from "./apparatus-geometry.ts";
import { dimensionEnds } from "./drawing.ts";
import { blockCorners } from "./geometry.ts";
import { referencePoint, type MechanicsState } from "./init.ts";
import { apexPoint } from "./projectile-geometry.ts";
import { measuredAngle, rayPoint } from "./rays.ts";
import type { MechanicsObject, Vec } from "./schema.ts";

const GAP = 0.6;

/** 한 글자 부품. id 는 손잡이 전체 이름이다. */
export type LabelPart = { id: string; x: number; y: number; text: string; size: number };

/**
 * 객체에 붙은 모든 글자.
 * @param ctx 봉투 투영과 글자 크기
 * @param state 해석된 장면
 * @param object 라벨 소유 객체
 * @returns 숨김·빈 문구는 빠진다. 참조 오류는 init 계약을 따른다
 */
export function objectLabels(ctx: CompileCtx, state: MechanicsState, object: MechanicsObject): LabelPart[] {
  if (object.show === false) return [];
  const { toPage } = projectView(ctx, ctx.view);
  const size = object.labelSize ?? ctx.style.textSize;
  const parts: LabelPart[] = [];
  const main = object.type === "angle" ? angleText(object, state) : object.label;
  const center = main ? labelCenter(object, state, toPage, measureLabelMm(main, size)) : undefined;
  if (main && center) parts.push(place(mainId(object), main, size, center, object.labelOffset));
  parts.push(...partLabels(state, object, toPage, size));
  return parts;
}

/**
 * 본문 라벨 하나. 편집 테스트가 기존 baseline 과 비교한다.
 * @returns 본문 라벨이 없으면 undefined
 */
export function objectLabelAnchor(ctx: CompileCtx, state: MechanicsState, object: MechanicsObject): { x: number; y: number; text: string; size: number } | undefined {
  const part = objectLabels(ctx, state, object).find((item) => item.id === mainId(object));
  if (!part) return undefined;
  return { x: part.x, y: part.y, text: part.text, size: part.size };
}

function mainId(object: MechanicsObject): string {
  return object.type === "label" ? object.id : `${object.id}:label`;
}

function angleText(object: Extract<MechanicsObject, { type: "angle" }>, state: MechanicsState): string | undefined {
  if (!object.auto) return object.label;
  const vertex = referencePoint(object.v, state);
  const degrees = measuredAngle(vertex, rayPoint(object.a, vertex, state), rayPoint(object.b, vertex, state));
  return degrees === undefined ? undefined : degreeTex(degrees);
}

function partLabels(state: MechanicsState, object: MechanicsObject, toPage: (x: number, y: number) => Vec, size: number): LabelPart[] {
  if (object.type === "force" && object.angleMark) {
    const text = object.angleMark.auto ? forceDegrees(object, state) : object.angleMark.label;
    const center = text ? forceMarkCenter(object, state, toPage) : undefined;
    return text && center ? [place(`${object.id}:angle-label`, text, size, center, object.angleMark.labelOffset)] : [];
  }
  if (object.type !== "trajectory") return [];
  const flight = state.curves.get(object.id);
  if (!flight) return [];
  const parts: LabelPart[] = [];
  const add = (suffix: string, text: string | undefined, at: Vec | undefined, offset?: Vec) => {
    if (!text || !at) return;
    parts.push(place(`${object.id}:${suffix}`, text, size, at, offset));
  };
  if (object.launch?.label) add("launch-label", object.launch.label, besideLaunch(flight, toPage, object.launch.length), object.launch.labelOffset);
  if (object.arrival?.label) add("arrival-label", object.arrival.label, toPage(...flight.b), object.arrival.labelOffset);
  if (object.launchAngle && Math.abs(flight.angle) >= 0.5) {
    const text = object.launchAngle.auto ? degreeTex(flight.angle) : object.launchAngle.label;
    add("angle-label", text, angleLabelAt(flight, toPage), object.launchAngle.labelOffset);
  }
  if (object.apex?.label) add("apex-label", object.apex.label, toPage(...apexPoint(flight)), object.apex.labelOffset);
  return parts;
}

function place(id: string, text: string, size: number, center: Vec, offset?: Vec): LabelPart {
  const box = measureLabelMm(text, size);
  const shift = offset ?? [0, 0];
  return {
    id, text, size,
    x: center[0] + shift[0] - box.x - box.w / 2,
    y: center[1] + shift[1] - box.y - box.h / 2,
  };
}

function labelCenter(object: MechanicsObject, state: MechanicsState, toPage: (x: number, y: number) => Vec, box: { w: number; h: number }): Vec | undefined {
  switch (object.type) {
    case "spring": return springLabel(state.paths.get(object.id) ?? [], toPage, box);
    case "rope": return ropeLabel(state.paths.get(object.id) ?? [], toPage, box);
    case "pulley": {
      const top = toPage(object.center[0], object.center[1] + object.radius);
      return [top[0], top[1] - box.h / 2 - GAP];
    }
    case "support": {
      const [, a, b] = supportCorners(object).map((point) => toPage(...point)) as [Vec, Vec, Vec];
      return [mid(a, b)[0], Math.max(a[1], b[1]) + 1.1 + GAP + box.h / 2];
    }
    case "block": {
      const pose = state.poses.get(object.id);
      if (!pose) return undefined;
      const corners = blockCorners(object, pose);
      return toPage((corners[0]![0] + corners[2]![0]) / 2, (corners[0]![1] + corners[2]![1]) / 2);
    }
    case "ball": {
      const ball = state.balls.get(object.id);
      return ball ? toPage(...ball.center) : undefined;
    }
    case "point": {
      const at = toPage(...referencePoint(object.at, state));
      return [at[0] + box.w / 2 + GAP, at[1] - box.h / 2 - GAP];
    }
    case "track": return trackLabel(object, state, toPage, box);
    case "trajectory": {
      const flight = state.curves.get(object.id);
      return flight ? mid(toPage(...flight.a), toPage(...flight.b)) : undefined;
    }
    case "angle": return angleCenter(object, state, toPage);
    case "label": return toPage(...referencePoint(object.at, state));
    case "dimension": {
      const [a, b] = dimensionEnds(object, state);
      return mid(toPage(...a), toPage(...b));
    }
    case "guide": {
      const center = mid(toPage(...referencePoint(object.a, state)), toPage(...referencePoint(object.b, state)));
      return [center[0], center[1] - box.h / 2 - GAP];
    }
    case "force": return forceLabel(object, state, toPage, box);
  }
}

function trackLabel(object: Extract<MechanicsObject, { type: "track" }>, state: MechanicsState, toPage: (x: number, y: number) => Vec, box: { w: number; h: number }): Vec | undefined {
  const points = state.tracks.get(object.id);
  if (!points?.length) return undefined;
  const center = mid(toPage(...points[0]!), toPage(...points[points.length - 1]!));
  if (!object.ground) return [center[0], center[1] + box.h / 2 + GAP];
  const half = object.ground.depth / 2;
  const shift = object.ground.side === "above" ? [0, -half] : object.ground.side === "left" ? [-half, 0]
    : object.ground.side === "right" ? [half, 0] : [0, half];
  return [center[0] + shift[0], center[1] + shift[1]];
}

function springLabel(points: Vec[], toPage: (x: number, y: number) => Vec, box: { w: number; h: number }): Vec | undefined {
  const page = points.map((point) => toPage(...point));
  if (!page.length) return undefined;
  const a = page[0]!;
  const b = page.at(-1)!;
  const center = mid(a, b);
  return Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0])
    ? [Math.max(...page.map((point) => point[0])) + box.w / 2 + GAP, center[1]]
    : [center[0], Math.min(...page.map((point) => point[1])) - box.h / 2 - GAP];
}

function ropeLabel(points: Vec[], toPage: (x: number, y: number) => Vec, box: { w: number; h: number }): Vec | undefined {
  const page = points.map((point) => toPage(...point));
  if (page.length < 2) return undefined;
  let a = page[0]!;
  let b = page[1]!;
  for (let index = 2; index < page.length; index += 1) {
    if (Math.hypot(page[index]![0] - page[index - 1]![0], page[index]![1] - page[index - 1]![1]) > Math.hypot(b[0] - a[0], b[1] - a[1])) {
      a = page[index - 1]!; b = page[index]!;
    }
  }
  return beside(a, b, box);
}

function forceLabel(object: Extract<MechanicsObject, { type: "force" }>, state: MechanicsState, toPage: (x: number, y: number) => Vec, box: { w: number; h: number }): Vec {
  const start = referencePoint(object.from, state);
  return beside(toPage(...start), toPage(start[0] + object.delta[0], start[1] + object.delta[1]), box);
}

function angleCenter(object: Extract<MechanicsObject, { type: "angle" }>, state: MechanicsState, toPage: (x: number, y: number) => Vec): Vec | undefined {
  const vertex = referencePoint(object.v, state);
  const a = rayPoint(object.a, vertex, state);
  const b = rayPoint(object.b, vertex, state);
  const pageV = toPage(...vertex);
  const pageA = toPage(...a);
  const pageB = toPage(...b);
  const radius = (object.radius ?? 3) + GAP;
  const start = Math.atan2(pageA[1] - pageV[1], pageA[0] - pageV[0]);
  const end = Math.atan2(pageB[1] - pageV[1], pageB[0] - pageV[0]);
  const mid = start + shorter(start, end) / 2;
  return [pageV[0] + Math.cos(mid) * radius, pageV[1] + Math.sin(mid) * radius];
}

function besideLaunch(flight: { a: Vec; s: number; T: number }, toPage: (x: number, y: number) => Vec, length: number): Vec {
  const origin = toPage(...flight.a);
  const dir = pageDir(toPage, flight.a, [flight.s, flight.T]);
  return [origin[0] + dir[0] * length, origin[1] + dir[1] * length];
}

function angleLabelAt(flight: { a: Vec; s: number; T: number; angle: number }, toPage: (x: number, y: number) => Vec): Vec {
  const origin = toPage(...flight.a);
  const horizontal = pageDir(toPage, flight.a, [flight.s, 0]);
  const launch = pageDir(toPage, flight.a, [flight.s, flight.T]);
  const a0 = Math.atan2(horizontal[1], horizontal[0]);
  const a1 = Math.atan2(launch[1], launch[0]);
  const mid = a0 + shorter(a0, a1) / 2;
  return [origin[0] + Math.cos(mid) * (3 + GAP), origin[1] + Math.sin(mid) * (3 + GAP)];
}

function forceDegrees(object: Extract<MechanicsObject, { type: "force" }>, state: MechanicsState): string {
  const start = referencePoint(object.from, state);
  const end: Vec = [start[0] + object.delta[0], start[1] + object.delta[1]];
  const base: Vec = object.angleMark?.reference === "vertical" ? [start[0], start[1] + 1] : [start[0] + 1, start[1]];
  return degreeTex(measuredAngle(start, base, end) ?? 0);
}

function forceMarkCenter(object: Extract<MechanicsObject, { type: "force" }>, state: MechanicsState, toPage: (x: number, y: number) => Vec): Vec {
  const start = referencePoint(object.from, state);
  return toPage(start[0] + object.delta[0] * 0.25, start[1] + object.delta[1] * 0.25);
}

function beside(a: Vec, b: Vec, box: { w: number; h: number }): Vec {
  const center = mid(a, b);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let normal: Vec = length < 1e-9 ? [0, -1] : [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
  if (normal[1] > 0) normal = [-normal[0], -normal[1]];
  const gap = GAP + (Math.abs(normal[0]) * box.w + Math.abs(normal[1]) * box.h) / 2;
  return [center[0] + normal[0] * gap, center[1] + normal[1] * gap];
}

function pageDir(toPage: (x: number, y: number) => Vec, origin: Vec, dir: Vec): Vec {
  const a = toPage(...origin);
  const b = toPage(origin[0] + dir[0], origin[1] + dir[1]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return length < 1e-9 ? [1, 0] : [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
}

function shorter(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function mid(a: Vec, b: Vec): Vec {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
