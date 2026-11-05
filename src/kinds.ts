/**
 * The figure kinds this package ships and the starting content of each creation tool.
 * The adapter (figure-aspect.ts, engine.ts) never branches on these names.
 */
import { mathGeometryPlugin } from "@stemfig/plugin-math-geometry";
import { physicsMechanicsPlugin } from "@stemfig/plugin-physics-mechanics";
import type { StemfigPlugin } from "@stemfig/host";
import { CONTENT_SCHEMA, type FigureProps } from "./content.ts";
import type { FigureKind } from "./figure-aspect.ts";
import { mmToWorld } from "./units.ts";

export const stemfigPlugins: readonly StemfigPlugin[] = [
  mathGeometryPlugin as unknown as StemfigPlugin,
  physicsMechanicsPlugin as unknown as StemfigPlugin,
];

/** A tool-shelf button: one kind, one starting figure, one size. */
export type CreationPreset = {
  name: string;
  label: string;
  summary: string;
  kind: string;
  props: FigureProps;
  /** Page size in mm, as a stemfig figure frame. */
  size_mm: { w: number; h: number };
};

const blank = (view: FigureProps["view"], spec: Record<string, unknown>, extra: Partial<FigureProps> = {}): FigureProps => ({
  schema: CONTENT_SCHEMA, view, grid: null, axes: null, color: "", handles: null, spec, ...extra,
});

export function figureKinds(namespace: string): FigureKind[] {
  return [
    {
      kind: "math.geometry",
      aspectId: `${namespace}.geometry`,
      label: "기하 작도",
      summary: "점·선분·원과 파생 작도, 함수 그래프를 담는 그림",
      defaults: blank({ xmin: -0.5, xmax: 10.5, ymin: -0.5, ymax: 7.5 }, { objects: [] }),
      defaultSize: { width: mmToWorld(70), height: mmToWorld(50) },
    },
    {
      kind: "physics.mechanics",
      aspectId: `${namespace}.mechanics`,
      label: "역학 도식",
      summary: "경로·물체·용수철·도르래·힘 화살표를 담는 그림",
      defaults: blank({ xmin: 0, xmax: 20, ymin: 0, ymax: 10 }, { objects: [] }),
      defaultSize: { width: mmToWorld(100), height: mmToWorld(50) },
    },
  ];
}

/**
 * Starting figures for the creation buttons. Each opens with a small, editable
 * example rather than an empty frame, so it is visible and selectable at once.
 */
export const creationPresets: readonly CreationPreset[] = [
  {
    name: "add-geometry",
    label: "기하 작도 추가",
    summary: "삼각형 하나로 시작하는 기하 작도를 추가합니다.",
    kind: "math.geometry",
    size_mm: { w: 70, h: 50 },
    props: blank({ xmin: -0.5, xmax: 4.5, ymin: -0.5, ymax: 3.5 }, {
      objects: [
        { id: "A", def: ["point", 0, 0], label: "A" },
        { id: "B", def: ["point", 4, 0], label: "B" },
        { id: "C", def: ["point", 1.2, 3], label: "C" },
        { id: "c", def: ["segment", "A", "B"] },
        { id: "a", def: ["segment", "B", "C"] },
        { id: "b", def: ["segment", "C", "A"] },
      ],
    }),
  },
  {
    name: "add-graph",
    label: "함수 그래프 추가",
    summary: "좌표축과 격자 위에 y = x²/2 − 1 그래프를 추가합니다.",
    kind: "math.geometry",
    size_mm: { w: 70, h: 50 },
    props: blank({ xmin: -3, xmax: 3, ymin: -2, ymax: 3 }, {
      objects: [{ id: "f", def: ["graph", "y = x^2/2 - 1"] }],
    }, { grid: {}, axes: { x: { label: "x" }, y: { label: "y" } } }),
  },
  {
    name: "add-mechanics",
    label: "역학 도식 추가",
    summary: "지면 위 물체와 힘 화살표로 시작하는 역학 도식을 추가합니다.",
    kind: "physics.mechanics",
    size_mm: { w: 100, h: 50 },
    props: blank({ xmin: 0, xmax: 20, ymin: -1, ymax: 9 }, {
      objects: [
        { id: "floor", type: "track", points: [[1, 1], [19, 1]], rounding: 0, ground: { style: "hatch", side: "below", depth: 2 } },
        { id: "box", type: "block", width: 3, height: 2, label: "$m$", labelSize: 3, pose: { mode: "track", track: "floor", t: 0.4, offset: 0 } },
        { id: "push", type: "force", label: "$F$", labelSize: 3, delta: [3, 0], from: { mode: "anchor", object: "box", anchor: "right" } },
      ],
    }),
  },
];
