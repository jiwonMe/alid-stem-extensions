/**
 * 역학 객체의 HUD 손잡이·히트·자석을 페이지 mm에서 판정한다.
 * 표시 라벨은 compile과 같은 baseline을 쓰고 선택 id만 호스트에 돌려준다.
 * 도형 관계·허용 목록은 플러그인이 책임진다. 앱과 렌더러는 가져오지 않는다.
 */
import { DEFAULT_STYLE, measureLabelMm, toPage } from "@stemfig/display";
import type { AnchorsCtx, HandleAnchor, HandleId, HitCtx, SnapCtx, SnapHit } from "@stemfig/host";
import { paramOnSeg, projectView } from "@stemfig/plugin-kit";
import { motionAnchors } from "./anchors.ts";
import { dimensionEnds } from "../drawing.ts";
import { objectLabels } from "../labels.ts";
import { blockCorners } from "../geometry.ts";
import { supportCorners } from "../apparatus-geometry.ts";
import { referencePoint, type MechanicsState } from "../init.ts";
import type { MechanicsObject, Vec } from "../schema.ts";
import { allowedHandle, ownerId, referenceAt, trackAt } from "./shared.ts";

/* 기존 교과 편집 손잡이의 1.1mm 히트 여유를 따른다. 자석 반경은 shared의 화면 px 규칙이다. */
const HIT_MM = 1.1;

/**
 * 원본 제어점과 화면 도형을 같은 id 체계의 HUD로 만든다.
 * @param ctx compile과 같은 투영·스타일, 선택적으로 제한한 편집 손잡이 목록
 * @param state init이 검증한 장면
 * @returns 허용된 표시 객체의 손잡이. 숨김·누락 파생 도형은 제외하며 상태는 바꾸지 않는다
 */
export function anchorsMechanics(ctx: AnchorsCtx, state: MechanicsState): HandleAnchor[] {
  const { toPage: page } = projectView(ctx, ctx.view);
  const output: HandleAnchor[] = [];
  for (const object of state.spec.objects) {
    if (object.show === false) continue;
    output.push(...objectAnchors(object, state, page, ctx));
    for (const label of objectLabels(ctx, state, object)) {
      output.push({ id: label.id, kind: "text", x_mm: label.x, y_mm: label.y, text: label.text, size_mm: label.size, owner: object.id });
    }
  }
  return output.filter((anchor) => allowedHandle(anchor.id, ctx.handles));
}

function objectAnchors(object: MechanicsObject, state: MechanicsState, page: (x: number, y: number) => Vec, ctx: AnchorsCtx): HandleAnchor[] {
  const point = (id: string, position: Vec): HandleAnchor => {
    const [x_mm, y_mm] = page(...position);
    return { id, kind: "point", x_mm, y_mm };
  };
  const line = (a: Vec, b: Vec): HandleAnchor => {
    const [x1_mm, y1_mm] = page(...a);
    const [x2_mm, y2_mm] = page(...b);
    /* 양 끝 제어점은 별도 id다. 본선의 자동 노브를 켜면 다른 편집 동작이 같은 자리에 겹친다. */
    return { id: object.id, kind: "line", x1_mm, y1_mm, x2_mm, y2_mm, knobs: false };
  };
  switch (object.type) {
    case "track": return [{ id: object.id, kind: "polyline", points: (state.tracks.get(object.id) ?? []).map((p) => page(...p)) },
      ...object.points.map((p, index) => point(`${object.id}:point:${index}`, p))];
    case "block": {
      const pose = state.poses.get(object.id);
      if (!pose) return [];
      const corners = blockCorners(object, pose).map((p) => page(...p));
      return [{ id: object.id, kind: "polyline", points: [...corners, corners[0]!] }];
    }
    case "pulley": {
      const [cx_mm, cy_mm] = page(...object.center);
      const east: Vec = [object.center[0] + object.radius, object.center[1]];
      const north: Vec = [object.center[0], object.center[1] + object.radius];
      return [{ id: object.id, kind: "ellipse", cx_mm, cy_mm,
        rx_mm: Math.abs(page(...east)[0] - cx_mm), ry_mm: Math.abs(page(...north)[1] - cy_mm) },
        point(`${object.id}:center`, object.center), point(`${object.id}:radius`, east)];
    }
    case "support": {
      const corners = supportCorners(object).map(p => page(...p));
      return [{ id: object.id, kind: "polyline", points: [...corners, corners[0]!] }, point(`${object.id}:point`, object.point)];
    }
    case "spring":
    case "rope": return [{ id: object.id, kind: "polyline", points: (state.paths.get(object.id) ?? []).map(p => page(...p)) },
      point(`${object.id}:a`, referencePoint(object.a, state)), point(`${object.id}:b`, referencePoint(object.b, state))];
    case "force": {
      const a = referencePoint(object.from, state);
      const b: Vec = [a[0] + object.delta[0], a[1] + object.delta[1]];
      return [line(a, b), point(`${object.id}:from`, a), point(`${object.id}:end`, b)];
    }
    case "dimension":
    case "guide": {
      const a = referencePoint(object.a, state);
      const b = referencePoint(object.b, state);
      const ends = object.type === "dimension" ? dimensionEnds(object, state) : [a, b] as [Vec, Vec];
      /* 치수 끝 제어점은 참조 위치에 둔다. 본선 드래그만 offset을 바꾼다. */
      return [line(...ends), point(`${object.id}:a`, a), point(`${object.id}:b`, b)];
    }
    case "label": return [point(`${object.id}:at`, referencePoint(object.at, state))];
    case "ball":
    case "point":
    case "trajectory":
    case "angle": return motionAnchors(object, state, page, ctx);
  }
}

/**
 * 글자 상자, 제어점, 도형 순서로 선택해 라벨이 선에 가려지지 않게 한다.
 * @param ctx 페이지 포인터와 봉투. HitCtx에 스타일이 없으므로 호스트 기본 글자 크기를 쓴다
 * @param state 현재 작도
 * @returns 가장 가까운 허용 id. 블록·도르래·받침대 내부도 선택하며 대상이 없으면 null이다
 */
export function hitMechanics(ctx: HitCtx, state: MechanicsState): HandleId | null {
  const anchors = anchorsMechanics({ ...ctx, style: DEFAULT_STYLE,
    mmToPage: (x, y) => [ctx.frame.x + x, ctx.frame.y + y] }, state).reverse();
  const pointer: Vec = [ctx.x_mm, ctx.y_mm];
  for (const anchor of anchors) {
    if (anchor.kind !== "text") continue;
    const box = measureLabelMm(anchor.text, anchor.size_mm);
    if (pointer[0] >= anchor.x_mm + box.x && pointer[0] <= anchor.x_mm + box.x + box.w &&
      pointer[1] >= anchor.y_mm + box.y && pointer[1] <= anchor.y_mm + box.y + box.h) return anchor.id;
  }
  let best: { id: string; distance: number } | undefined;
  const selected = (): string | null => best?.id ?? null;
  const consider = (id: string, distance: number) => {
    if (distance <= HIT_MM && (!best || distance < best.distance)) best = { id, distance };
  };
  for (const anchor of anchors) {
    if (anchor.kind === "point") consider(anchor.id, Math.hypot(pointer[0] - anchor.x_mm, pointer[1] - anchor.y_mm));
  }
  const pointHit = selected();
  if (pointHit) return pointHit;
  for (const anchor of anchors) {
    if (anchor.kind === "line") consider(anchor.id, paramOnSeg(pointer, { id: anchor.id,
      a: [anchor.x1_mm, anchor.y1_mm], b: [anchor.x2_mm, anchor.y2_mm] }).d);
    if (anchor.kind === "ellipse") {
      const relative = Math.hypot((pointer[0] - anchor.cx_mm) / anchor.rx_mm, (pointer[1] - anchor.cy_mm) / anchor.ry_mm);
      /* 도르래는 면을 누르면 이동한다. stretch 투영에서도 원본 원의 내부를 보존한다. */
      if (relative <= 1) consider(anchor.id, 0);
      else consider(anchor.id, ellipseDistance(pointer, anchor));
    }
    if (anchor.kind !== "polyline") continue;
    const type = state.byId.get(anchor.id)?.type;
    if ((type === "block" || type === "support") && insidePolygon(pointer, anchor.points)) consider(anchor.id, 0);
    for (let index = 1; index < anchor.points.length; index += 1) {
      consider(anchor.id, paramOnSeg(pointer, { id: anchor.id, a: anchor.points[index - 1]!, b: anchor.points[index]! }).d);
    }
  }
  return selected();
}

function insidePolygon(point: Vec, points: Vec[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index]!;
    const b = points[previous]!;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function ellipseDistance(point: Vec, ellipse: Extract<HandleAnchor, { kind: "ellipse" }>): number {
  /* 기하 플러그인의 원 외곽과 같은 0.02mm 현 오차로 화면상 거리를 판정한다.
   * 단순 정규화 반지름 거리는 stretch된 긴 타원의 끝에서 먼 클릭을 오인한다. */
  const radius = Math.max(ellipse.rx_mm, ellipse.ry_mm);
  const count = Math.max(24, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - 0.02 / Math.max(radius, 0.02)))));
  const at = (index: number): Vec => [ellipse.cx_mm + ellipse.rx_mm * Math.cos(index * 2 * Math.PI / count),
    ellipse.cy_mm + ellipse.ry_mm * Math.sin(index * 2 * Math.PI / count)];
  let best = Infinity;
  let previous = at(0);
  for (let index = 1; index <= count; index += 1) {
    const next = at(index);
    best = Math.min(best, paramOnSeg(point, { id: ellipse.id, a: previous, b: next }).d);
    previous = next;
  }
  return best;
}

/**
 * 배치와 같은 연결점·경로 후보만 자석 HUD에 제공한다.
 * @param ctx 포인터·화면 배율. Alt는 unsnap, 끌고 있는 손잡이는 exclude다
 * @param state 현재 표시 객체와 해석된 연결점
 * @returns 기구 연결점 우선, 그다음 경로의 페이지 좌표. 자유점·Alt·반경 밖은 undefined다
 */
export function snapMechanics(ctx: SnapCtx, state: MechanicsState): SnapHit | undefined {
  if (ctx.unsnap) return undefined;
  const place = { ...ctx, tool: "snap" };
  const exclude = ctx.exclude ? ownerId(ctx.exclude) : undefined;
  const ref = referenceAt(place, state, exclude);
  const page = toPage(ctx.view, ctx.frame);
  if (ref.mode === "anchor") {
    const [x_mm, y_mm] = page(...referencePoint(ref, state));
    return { kind: "point", id: ref.object, x_mm, y_mm };
  }
  const track = trackAt(place, state, exclude);
  if (!track) return undefined;
  const [x_mm, y_mm] = page(...track.point);
  return { kind: "path", id: track.id, x_mm, y_mm };
}
