/**
 * physics.mechanics@1 등록 객체. 정적 교재 역학 작도의 첫 구현이다.
 * 앱은 tools/fields만 읽고 spec 해석은 이 패키지 안에 남긴다.
 * 의존 방향은 host·plugin-kit·display이며 Grida와 UI 컴포넌트를 import하지 않는다.
 */
import type { FigureTool, StemfigPlugin } from "@stemfig/host";
import { compileMechanics } from "./compile.ts";
import { initMechanics, type MechanicsState } from "./init.ts";
import { mechanicsSpecSchema, type MechanicsSpec } from "./schema.ts";
import { applyMechanics, removeMechanics } from "./interact/apply.ts";
import { applyFieldMechanics, fieldsMechanics, validateFieldMechanics } from "./interact/fields.ts";
import { anchorsMechanics, hitMechanics, snapMechanics } from "./interact/hit.ts";
import { cancelMechanics, finishMechanics, guidanceMechanics, placeMechanics } from "./interact/place.ts";
import { previewMechanics } from "./interact/preview.ts";

/** 역학 작도 원본과 객체의 공개 타입. 앱이 직접 분기하는 데 쓰지 않는다. */
export type { MechanicsSpec, MechanicsObject, Vec, PointRef, BlockPose, Track, Block, Spring, Pulley, Support, Rope } from "./schema.ts";
/** JSON을 해석한 상태. 렌더러나 undo 스택을 포함하지 않는다. */
export type { MechanicsState, ResolvedPose } from "./init.ts";
/** 플러그인 fixture와 순수 작도 검증에 사용하는 공개 진입점이다. */
export { initMechanics } from "./init.ts";

/* 도구의 아이콘 이름은 기존 UI 큐레이션에 있는 것만 사용한다. 패키지 의존은 추가하지 않는다. */
const surface = { id: "surface", label: "지면" };
const body = { id: "body", label: "물체" };
const apparatus = { id: "apparatus", label: "기구" };
const measure = { id: "measure", label: "치수" };
const mark = { id: "mark", label: "점" };
const tools: readonly FigureTool[] = [
  { id: "ground", label: "지면", icon: "ground", shortcut: "G", group: surface },
  { id: "track", label: "경로", icon: "track", shortcut: "L", group: surface },
  { id: "block", label: "상자", icon: "block", shortcut: "B", group: body },
  { id: "ball", label: "공", icon: "ball", shortcut: "O", group: body },
  { id: "spring", label: "용수철", icon: "spring", group: apparatus },
  { id: "pulley", label: "도르래", icon: "pulley", group: apparatus },
  { id: "rope", label: "실", icon: "rope", group: apparatus },
  { id: "support", label: "받침대", icon: "support", group: apparatus },
  { id: "sep-motion", separator: true },
  { id: "trajectory", label: "포물선", icon: "trajectory", shortcut: "T" },
  { id: "force", label: "힘 화살표", icon: "arrowUpRight", shortcut: "F" },
  { id: "sep-mark", separator: true },
  { id: "angle", label: "각도", icon: "angleAnnotation", shortcut: "A" },
  { id: "dimension", label: "높이·거리", icon: "dimension", shortcut: "D", group: measure },
  { id: "guide", label: "점선 보조선", icon: "guide", group: measure },
  { id: "sep-label", separator: true },
  { id: "point", label: "점", icon: "point", shortcut: "P", group: mark },
  { id: "label", label: "라벨", icon: "label", group: mark },
];
const names = { track: "경로", block: "물체", ball: "공", point: "점", trajectory: "포물선", angle: "각도",
  spring: "용수철", pulley: "도르래", rope: "실", support: "받침대",
  force: "힘", dimension: "치수", guide: "보조선", label: "라벨" };
const icons = { track: "track", block: "block", ball: "ball", point: "point", trajectory: "trajectory", angle: "angleAnnotation",
  spring: "spring", pulley: "pulley", rope: "rope", support: "support",
  force: "arrowUpRight", dimension: "dimension", guide: "guide", label: "label" };

/**
 * 빈 장면의 창은 가로 20 장면 단위로 시작하고 세로는 생성한 figure의 비율을 따른다.
 * @param frame 새 figure의 페이지 크기
 * @returns 빈 spec과 봉투 view. 물리적 단위나 고정된 용지 크기를 가정하지 않는다.
 */
function seed(frame: { w: number; h: number }) {
  const width = 20;
  const height = width * frame.h / frame.w;
  return { spec: { objects: [] } satisfies MechanicsSpec,
    view: { xmin: 0, xmax: width, ymin: 0, ymax: height } };
}

/**
 * 역학 작도 엔진의 단일 공개 등록 객체.
 * 문서 변경은 호스트를 통해 HistoryStore.transact에 맡긴다. 이 객체는 undo를 소유하지 않는다.
 */
export const physicsMechanicsPlugin: StemfigPlugin<MechanicsSpec, MechanicsState> = {
  kind: "physics.mechanics", version: 1, specSchema: mechanicsSpecSchema,
  init: initMechanics, compile: compileMechanics,
  toSpec: (state) => state.spec,
  tools, create: { label: "역학", icon: "mechanics", seed },
  place: placeMechanics,
  finish: finishMechanics, preview: previewMechanics, guidance: guidanceMechanics, cancel: cancelMechanics,
  hit: hitMechanics, anchors: anchorsMechanics, snap: snapMechanics, apply: applyMechanics,
  fields: fieldsMechanics, applyField: applyFieldMechanics, validateField: validateFieldMechanics,
  remove: removeMechanics,
  layers: (state) => state.spec.objects.map((obj) => ({ id: obj.id,
    title: obj.label ? `${names[obj.type]} ${obj.label}` : `${names[obj.type]} ${obj.id}`,
    kind: names[obj.type], icon: icons[obj.type] })),
};
