/**
 * 역학 도구의 다음 클릭 안내.
 * 앱은 문장과 완료 가능 여부만 그린다. 단계 번호는 여기서만 센다.
 */
import type { ToolGuidance } from "@stemfig/host";
import type { MechanicsState } from "../init.ts";

/**
 * @param ctx 현재 도구 id
 * @param state 진행 중이면 draft 가 있다
 * @returns 다음 클릭 안내. 모르는 도구는 undefined
 */
export function guidanceMechanics(ctx: { tool: string }, state: MechanicsState): ToolGuidance | undefined {
  const draft = state.spec.draft?.tool === ctx.tool ? state.spec.draft : undefined;
  const canCancel = Boolean(draft);
  const line = (start: string, next: string, done: string) => ({ canCancel, canFinish: Boolean(draft && draft.points.length >= 2),
    message: !draft ? start : draft.points.length < 2 ? next : done });
  switch (ctx.tool) {
    case "track": return line("경로의 시작점을 클릭하세요.", "다음 꼭짓점을 클릭하세요. Shift는 15° 간격입니다.", "꼭짓점을 추가하거나 Enter·완료 버튼으로 경로를 완성하세요.");
    case "ground": return line("지면의 시작점을 클릭하세요.", "다음 꼭짓점을 클릭하세요. Shift는 15° 간격입니다.", "꼭짓점을 추가하거나 Enter·완료 버튼으로 지면을 완성하세요.");
    case "block": return { canCancel: false, message: "경로 위를 클릭하면 상자가 부착됩니다. Alt를 누르면 자유롭게 배치합니다." };
    case "ball": return { canCancel: false, message: "지면 위를 클릭하면 공이 표면에 놓입니다. Alt를 누르면 중심에 놓입니다." };
    case "point": return { canCancel: false, message: "점을 클릭하세요. 자유로운 포물선 끝이면 그 끝을 이 점에 연결합니다." };
    case "trajectory": return { canCancel, message: !draft ? "발사 위치를 클릭하세요." : draft.angle === undefined
      ? "발사 방향을 클릭하세요. Shift는 15° 간격이며 각도가 커서 옆에 표시됩니다." : "도착 위치를 클릭하세요." };
    case "angle": return { canCancel, message: !draft ? "각의 꼭짓점을 클릭하세요." : !draft.ray
      ? "첫 번째 변을 클릭하세요. 포물선 끝 근처는 접선이 됩니다." : "두 번째 변을 클릭하세요. 90°면 직각 표시가 됩니다." };
    case "force": return { canCancel, message: draft ? "힘 화살표의 끝을 클릭하세요. Shift는 15° 간격입니다." : "시작점을 클릭하세요. 물체의 연결점에 가까우면 함께 움직입니다." };
    case "dimension": return { canCancel, message: draft ? "두 번째 기준점을 클릭하세요. 치수선 위치는 드래그로 조절합니다." : "높이 또는 거리의 첫 기준점을 클릭하세요." };
    case "guide": return { canCancel, message: draft ? "보조선 끝을 클릭하세요." : "보조선 시작점을 클릭하세요." };
    case "spring": return { canCancel, message: draft ? "용수철의 두 번째 끝을 클릭하세요. 굵기와 감긴 수는 속성에서 조절합니다."
      : "용수철의 첫 끝을 클릭하세요. 기구의 연결점 가까이에서는 함께 움직입니다." };
    case "rope": return { canCancel, message: !draft ? "실의 첫 끝을 클릭하세요. 도르래를 감쌀 경우 두 끝은 원 밖에 놓습니다."
      : draft.pulley ? "도르래 바깥에 실의 끝을 클릭하세요. 짧은 방향으로 감으며 속성에서 방향을 바꿀 수 있습니다."
      : "도르래 원주를 클릭해 경유하거나 실의 끝을 클릭하세요. Alt를 누르면 곧은 실로 완성합니다." };
    case "pulley": return { canCancel, message: draft ? "도르래 원주를 클릭해 반지름을 정하세요." : "도르래 중심을 클릭하세요." };
    case "support": return { canCancel: false, message: "받침대의 꼭짓점을 클릭하세요. 폭·높이·기울기는 속성에서 조절합니다." };
    case "label": return { canCancel: false, message: "라벨을 놓고 속성에서 문구를 입력하세요. 수식은 $로 감쌉니다." };
    default: return undefined;
  }
}
