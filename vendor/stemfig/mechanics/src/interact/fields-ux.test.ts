/** 패널 표시 계약이 JSON의 기하 값과 연결 식별자를 바꾸지 않는지 검증한다. */
import { describe, expect, it } from "vitest";
import type { ApplyCtx } from "@stemfig/host";
import { initMechanics } from "../init.ts";
import { applyFieldMechanics, fieldsMechanics } from "./fields.ts";

const ctx: ApplyCtx = { frame: { x: 0, y: 0, w: 100, h: 100 }, view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 } };
const scene = () => initMechanics({ objects: [
  { id: "track", type: "track", points: [[0, 0], [10, 0]], rounding: 0 },
  { id: "A", type: "block", label: "A", width: 1, height: 1, pose: { mode: "track", track: "track", t: 0.31468226110966, offset: 0 } },
  { id: "B", type: "block", label: "A", width: 1, height: 1, pose: { mode: "free", point: [8, 3], angle: 0 } },
  { id: "spring", type: "spring", width: 1, coils: 8, a: { mode: "anchor", object: "A", anchor: "top" }, b: { mode: "anchor", object: "B", anchor: "bottom" } },
  { id: "rope", type: "rope", a: { mode: "free", point: [0, 5] }, b: { mode: "free", point: [5, 5] }, wrap: "cw" },
] });

describe("역학 속성 UX 계약", () => {
  it("위치는 백분율로 표시하지만 원본 t와 입력 정밀도는 유지한다", () => {
    const state = scene();
    const field = fieldsMechanics({ ...ctx, focus: "A" }, state).find(field => field.key === "t");
    expect(field).toMatchObject({ unit: "%", min: 0, max: 100, value: 31.468226110966 });
    const changed = applyFieldMechanics(ctx, state, { id: "A", key: "t", value: 62.5 });
    expect(changed.byId.get("A")).toMatchObject({ pose: { mode: "track", t: 0.625 } });
    expect(state.byId.get("A")).toMatchObject({ pose: { t: 0.31468226110966 } });
  });
  it("연결점·세부 조정·라벨을 구분하고 적용되지 않는 행은 생략한다", () => {
    const state = scene();
    const fields = fieldsMechanics({ ...ctx, focus: "spring" }, state);
    expect(fields.find(field => field.key === "a.target")?.group?.label).toBe("시작점");
    expect(fields.find(field => field.key === "a.offsetX")?.group?.defaultOpen).toBe(false);
    expect(fields.find(field => field.key === "b.target")?.group?.label).toBe("끝점");
    expect(fields.some(field => field.key === "labelSize" || field.key === "labelOffsetX")).toBe(false);
    expect(fieldsMechanics({ ...ctx, focus: "rope" }, state).some(field => field.key === "wrap")).toBe(false);
    const labelled = applyFieldMechanics(ctx, state, { id: "spring", key: "label", value: "k" });
    expect(fieldsMechanics({ ...ctx, focus: "spring" }, labelled).some(field => field.key === "labelSize")).toBe(true);
  });
  it("같은 라벨의 대상도 고유한 이름으로 구분하며 연결값은 유지한다", () => {
    const field = fieldsMechanics({ ...ctx, focus: "spring:a" }, scene()).find(field => field.key === "target");
    if (field?.type !== "enum") throw new Error("missing targets");
    expect(field.options.map(option => option.label)).toEqual(["자유 배치", "A · 물체 1", "A · 물체 2", "경로 1 점 1", "경로 1 점 2"]);
    expect(field.options.map(option => option.value)).toEqual(["free", "block:A", "block:B", "vertex:track:0", "vertex:track:1"]);
  });
});
