/**
 * 작도 단계 안내. draft 해석은 플러그인만 하며 앱에는 문장만 보낸다.
 * 취소는 확정된 점을 지우지 않는다. 이전 클릭의 점까지 되돌리려면 undo 를 쓴다.
 */
import type { ApplyCtx, ToolGuidance } from "@stemfig/host";
import { initGeometry, type GeometryState } from "../init.ts";
import { clearDraft } from "./resolve-point.ts";

/** @param state 현재 작도 @returns draft 만 제거한 상태. 진행 중이 아니면 입력 */
export function cancelGeometry(_ctx: ApplyCtx, state: GeometryState): GeometryState {
  return state.spec.draft ? initGeometry(clearDraft(state.spec)) : state;
}

/**
 * 각 도구가 실제로 받는 대상과 클릭 순서를 알려 준다.
 * @param ctx 도구 id. 앱에서 뜻을 해석하지 않는다
 * @returns 다음 클릭 안내. 모르는 도구는 undefined
 */
export function guidanceGeometry(ctx: { tool: string }, state: GeometryState): ToolGuidance | undefined {
  const draft = state.spec.draft?.tool === ctx.tool ? state.spec.draft : undefined;
  const result = (message: string): ToolGuidance => ({ message, canCancel: !!draft });
  if (ctx.tool === "point") return result("점을 놓을 위치를 선택하세요.");
  if (ctx.tool === "graph") return result("그래프를 놓을 위치를 선택한 뒤 속성에서 수식을 입력하세요.");
  if (ctx.tool === "path") return result("경로를 놓을 위치를 선택한 뒤 제어점을 움직이세요.");
  if (ctx.tool === "intersection") return result(draft ? "교차할 두 번째 경로를 선택하세요." : "교점을 만들 첫 번째 경로를 선택하세요.");
  if (["perpendicular", "parallel-line", "perpendicular-line"].includes(ctx.tool)) {
    return result(draft ? "기준 선분 또는 직선을 선택하세요." : "작도가 지날 점을 선택하세요.");
  }
  if (ctx.tool === "polygon") {
    const count = draft && "vertices" in draft ? draft.vertices.length : 0;
    return result(count >= 3 ? "다음 꼭짓점 또는 첫 점을 선택해 다각형을 닫으세요." : `${count + 1}번째 꼭짓점을 선택하세요. 최소 세 점이 필요합니다.`);
  }
  if (["angle-annotation", "angle-bisector", "circle-three-points", "circle-incircle"].includes(ctx.tool)) {
    const count = draft && "vertices" in draft ? draft.vertices.length : 0;
    if (count === 1 && ["angle-annotation", "angle-bisector"].includes(ctx.tool)) return result("각의 꼭짓점을 선택하세요.");
    return result(["첫 번째 점을 선택하세요.", "두 번째 점을 선택하세요.", "세 번째 점을 선택하세요."][count]!);
  }
  if (["segment", "line", "circle", "division", "segment-annotation"].includes(ctx.tool)) {
    if (ctx.tool === "circle") return result(draft ? "원을 지나는 점을 선택하세요." : "원의 중심을 선택하세요.");
    return result(draft ? "두 번째 점을 선택하세요." : "첫 번째 점을 선택하세요.");
  }
  return undefined;
}
