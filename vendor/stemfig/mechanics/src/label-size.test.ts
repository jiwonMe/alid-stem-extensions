/**
 * 라벨 크기를 저장한 뒤 출력·HUD·히트 판정이 동일한 실제 글자 상자를 쓰는지 검증한다.
 * 크기는 페이지 mm이며 봉투 view 확대나 장면 좌표의 길이에 비례하지 않아야 한다.
 */
import { DEFAULT_STYLE, measureLabelMm } from "@stemfig/display";
import type { CompileCtx } from "@stemfig/host";
import { describe, expect, it } from "vitest";
import { compileMechanics } from "./compile.ts";
import { initMechanics } from "./init.ts";
import { anchorsMechanics, hitMechanics } from "./interact/hit.ts";
import type { MechanicsObject } from "./schema.ts";

const ctx: CompileCtx = { frame: { x: 0, y: 0, w: 100, h: 100 },
  view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 },
  mmToPage: (x, y) => [x, y], style: DEFAULT_STYLE };

describe("역학 라벨 크기", () => {
  it("확대한 라벨의 끝부분도 출력과 같은 크기로 선택한다", () => {
    const object: MechanicsObject = { id: "caption", type: "label", label: "MMMMMMMM", labelSize: 3,
      at: { mode: "free", point: [5, 5] } };
    const state = initMechanics({ objects: [object] });
    const text = compileMechanics(ctx, state).find(item => item.op === "text")!;
    const anchor = anchorsMechanics(ctx, state).find(item => item.kind === "text");
    expect(text.size).toBe(3);
    expect(anchor).toMatchObject({ id: "caption", kind: "text", x_mm: text.x, y_mm: text.y, size_mm: 3 });
    const box = measureLabelMm(text.text, text.size);
    const point = { x_mm: text.x + box.x + box.w * 0.9, y_mm: text.y + box.y + box.h / 2 };
    expect(hitMechanics({ ...ctx, ...point }, state)).toBe("caption");
    const withoutOverride = initMechanics({ objects: [{ ...object, labelSize: undefined }] });
    expect(hitMechanics({ ...ctx, ...point }, withoutOverride)).toBeNull();
  });

  it("장면 확대를 바꿔도 명시한 mm 크기를 보존하고 나머지는 기본값을 상속한다", () => {
    const state = initMechanics({ objects: [
      { id: "large", type: "label", label: "F", labelSize: 3, at: { mode: "free", point: [3, 5] } },
      { id: "normal", type: "label", label: "A", at: { mode: "free", point: [7, 5] } },
    ] });
    for (const view of [ctx.view, { xmin: 0, xmax: 20, ymin: 0, ymax: 20 }]) {
      const sizes = compileMechanics({ ...ctx, view }, state).filter(item => item.op === "text").map(item => item.size);
      expect(sizes).toEqual([3, DEFAULT_STYLE.textSize]);
    }
  });
});
