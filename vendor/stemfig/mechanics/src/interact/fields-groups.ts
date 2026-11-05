/**
 * 역학 속성의 편집 순서와 사용자 용어를 선언한다.
 * 앱에는 그룹 제목·설명만 넘긴다. 앱이 키나 kind를 해석해 섹션을 추론하지 않는다.
 * 실제 값과 좌표 변환은 fields-read/write가 소유한다.
 */
import type { InspectField } from "@stemfig/host";
import type { MechanicsState } from "../init.ts";
import type { MechanicsObject } from "../schema.ts";
import type { FieldTarget } from "./fields-read.ts";

const names: Record<MechanicsObject["type"], string> = {
  block: "물체", track: "경로", ball: "공", point: "점", trajectory: "포물선", angle: "각도",
  pulley: "도르래", support: "받침대", spring: "용수철",
  rope: "실", force: "힘", dimension: "치수", guide: "보조선", label: "라벨",
};

/**
 * @param object 목록에 표시할 객체
 * @param state 현재 장면. 같은 종류의 문서 순서로 사람이 읽을 번호를 만든다.
 * @returns 라벨이 중복되어도 구별되는 선택 이름. 연결값 자체는 기존 객체 id를 유지한다.
 */
export function objectChoiceName(object: MechanicsObject, state: MechanicsState): string {
  const index = state.spec.objects.filter(item => item.type === object.type).findIndex(item => item.id === object.id);
  const name = `${names[object.type]} ${index + 1}`;
  return object.label ? `${object.label} · ${name}` : name;
}

/**
 * @param fields 원본 속성 행
 * @param target 선택한 객체·손잡이
 * @returns 앱에서 일반 Section으로 묶을 그룹과 설명을 붙인 새 행. 원본은 바꾸지 않는다.
 */
export function groupMechanicsFields(fields: InspectField[], target: FieldTarget): InspectField[] {
  return fields.map(field => {
    const { key } = field;
    if (key === "label" || key === "labelSize") return { ...field, group: { id: "label", label: "라벨", defaultOpen: Boolean(target.object.label) || target.part === "label" } };
    if (key.startsWith("labelOffset")) return { ...field, group: { id: "label-position", label: "라벨 위치", defaultOpen: target.part === "label",
      description: "종이 위 mm 간격입니다. X는 오른쪽, Y는 아래쪽이 양수입니다." } };
    if (key === "show" || key === "dashed" || key === "stroke" || key === "weight" || key === "fill" || key === "groundStyle" || key === "groundSide") {
      return { ...field, group: { id: "appearance", label: "표현", defaultOpen: false } };
    }
    const slot = key.includes(".") ? key.split(".")[0] : target.part;
    if (slot === "a" || slot === "b" || slot === "from" || slot === "at") {
      const name = slot === "b" ? "끝점" : slot === "at" ? "기준점" : "시작점";
      const advanced = key.includes("offset") || key.startsWith("offset");
      return { ...field, group: { id: `${slot}${advanced ? "-offset" : ""}`, label: advanced ? `${name} 미세 조정` : name,
        defaultOpen: !advanced, description: advanced ? "연결은 유지한 채 장면 좌표로 간격을 조절합니다." : "연결 대상을 고르거나 장면 좌표로 위치를 지정합니다." } };
    }
    if (key === "track" || key === "t" || key === "offset") return { ...field,
      ...(key === "t" ? { description: "0%는 경로 시작, 100%는 끝입니다." } : {}),
      group: { id: "attachment", label: "위치·연결", description: "간격은 장면 단위입니다. 물체는 경로의 모양을 따라갑니다." } };
    if (key === "x" || key === "y" || key === "angle") return { ...field,
      group: { id: "position", label: "위치", description: "장면 좌표입니다. X는 오른쪽, Y는 위쪽이 양수입니다." } };
    return { ...field, group: { id: "shape", label: "모양", description: "길이는 장면 단위입니다. 수식 라벨의 물리량과는 별개입니다." } };
  });
}
