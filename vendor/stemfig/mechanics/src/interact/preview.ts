/**
 * 커서 미리보기는 완료될 작도를 임시로 컴파일한다.
 * 결과를 JSON에 쓰지 않으며 HistoryStore 트랜잭션을 열지 않는다.
 */
import { DEFAULT_STYLE, toPage, type DisplayItem } from "@stemfig/display";
import type { PlaceCtx } from "@stemfig/host";
import { degreeTex } from "@stemfig/plugin-kit";
import { compileMechanics } from "../compile.ts";
import { initMechanics, referencePoint, type MechanicsState } from "../init.ts";
import { placeMechanics } from "./place.ts";
import { pulleyCircle } from "../apparatus-geometry.ts";
import { nearestOnTrack } from "../geometry.ts";
import { pulleyAt, shortestWrap } from "./rope-routing.ts";
import { launchAngle, nextId, scenePoint } from "./shared.ts";

/**
 * @param ctx 커서와 도구 @param state 저장된 작도
 * @returns 새 객체 또는 미완성 경로만 그린다. 용수철·실·도르래는 첫 클릭 뒤 실제 완성 경로를 미리 보인다.
 * 첫 클릭 전이나 반지름·연결점이 퇴화한 경우는 빈 배열이다.
 */
export function previewMechanics(ctx: PlaceCtx, state: MechanicsState): DisplayItem[] {
  try {
    const draft = state.spec.draft;
    const readout = motionPreview(ctx, state);
    if (readout) return readout;
    let next: MechanicsState;
    let ids: Set<string>;
    if (ctx.tool === "track" && draft?.tool === "track") {
      const id = "preview_track";
      next = initMechanics({ objects: [{ id, type: "track", points: [...draft.points, scenePoint(ctx)], rounding: 0 }] });
      ids = new Set([id]);
    } else {
      const result = placeMechanics(ctx, state);
      if (result?.handles?.length) {
        next = result.state;
        ids = new Set(result.handles);
        if (ctx.tool === "rope" && draft?.pulley) ids.add(draft.pulley);
      } else if (ctx.tool === "rope" && draft?.tool === "rope") {
        const selected = draft.pulley ? state.byId.get(draft.pulley) : pulleyAt(ctx, state);
        if (selected?.type !== "pulley") return [];
        next = state;
        ids = new Set([selected.id]);
        if (!draft.pulley) {
          /* 경유를 확정하기 전에도 원주와 현재 선택할 접속 경로를 함께 강조한다. */
          const near = nearestOnTrack(pulleyCircle(selected).map(point => toPage(ctx.view, ctx.frame)(...point)), [ctx.x_mm, ctx.y_mm]);
          const projected = scenePoint({ ...ctx, x_mm: near.point[0], y_mm: near.point[1] });
          const dx = projected[0] - selected.center[0], dy = projected[1] - selected.center[1];
          /* 샘플 선분의 최근접점은 원 안에 있으므로 정확한 원주로 올려 접선 검증과 맞춘다. */
          const radius = selected.radius / Math.hypot(dx, dy);
          const end: [number, number] = [selected.center[0] + dx * radius, selected.center[1] + dy * radius];
          const a = draft.from ?? { mode: "free" as const, point: draft.points[0]! };
          const wrap = shortestWrap(referencePoint(a, state), end, selected);
          if (wrap) {
            const id = nextId(state, "preview_rope");
            next = initMechanics({ ...state.spec, objects: [...state.spec.objects,
              { id, type: "rope", a, b: { mode: "free", point: end }, pulley: selected.id, wrap }] });
            ids.add(id);
          }
        }
      } else return [];
    }
    /* 참조 해석은 전체 상태로 하고 출력할 객체 목록만 좁힌다. */
    return compileMechanics({ frame: ctx.frame, view: ctx.view, style: DEFAULT_STYLE,
      mmToPage: (x, y) => [ctx.frame.x + x, ctx.frame.y + y] },
    { ...next, spec: { objects: next.spec.objects.filter((obj) => ids.has(obj.id)) } });
  } catch { return []; }
}

function motionPreview(ctx: PlaceCtx, state: MechanicsState): DisplayItem[] | undefined {
  const draft = state.spec.draft;
  const page = toPage(ctx.view, ctx.frame);
  const cursor = scenePoint(ctx);
  const text = (value: string): DisplayItem => ({ op: "text", x: ctx.x_mm + 2, y: ctx.y_mm, text: value, size: 3.2, fill: DEFAULT_STYLE.textFill });
  if (ctx.tool === "ground" && draft?.tool === "ground") {
    const from = draft.points[draft.points.length - 1]!;
    const aimed = ctx.constrain ? launchAngle(from, cursor, true) : undefined;
    const line = page(...from);
    return [{ op: "polyline", points: [line, [ctx.x_mm, ctx.y_mm]], stroke: DEFAULT_STYLE.stroke, width: DEFAULT_STYLE.width },
      ...(aimed === undefined ? [] : [text(degreeTex(aimed))])];
  }
  if (ctx.tool === "trajectory" && draft?.tool === "trajectory" && draft.angle === undefined) {
    const start = referencePoint(draft.from ?? { mode: "free", point: draft.points[0]! }, state);
    const angle = launchAngle(start, cursor, ctx.constrain);
    if (angle === undefined) return [];
    return [{ op: "polyline", points: [page(...start), [ctx.x_mm, ctx.y_mm]], stroke: DEFAULT_STYLE.stroke, width: DEFAULT_STYLE.width }, text(degreeTex(angle))];
  }
  if (ctx.tool === "force" && draft?.tool === "force") {
    const start = referencePoint(draft.from ?? { mode: "free", point: draft.points[0]! }, state);
    const angle = launchAngle(start, cursor, ctx.constrain);
    return angle === undefined ? [] : [text(degreeTex(angle))];
  }
  return undefined;
}
