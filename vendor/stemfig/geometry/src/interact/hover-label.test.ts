/**
 * 점 라벨 호버. 글자 위는 A:label. 점 마크는 A.
 * HUD 글리프는 앱 point-hud / label-hud.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE } from "@stemfig/display";
import { hitFigure, listAnchors, patchField } from "@stemfig/host";
import { labelHandleId } from "../label-handle.ts";
import {
  LABEL_DX_MM,
  LABEL_DY_MM,
  labelHitBox,
  labelOffsetMm,
} from "../label-pos.ts";
import { fixtureDoc, pageOf, registry } from "./test-harness.ts";

/** 글자 상자 가운데. 점 HIT 반경 밖이어야 A:label 이 이긴다. */
function labelCenter(ax: number, ay: number): [number, number] {
  const box = labelHitBox("A", DEFAULT_STYLE.textSize);
  return [
    ax + LABEL_DX_MM + box.x + box.w / 2,
    ay + LABEL_DY_MM + box.y + box.h / 2,
  ];
}

describe("hover point label", () => {
  it("lists A:label as a text anchor at the compile offset", () => {
    const [ax, ay] = pageOf(fixtureDoc, "A");
    const anchors = listAnchors(fixtureDoc, "tri", registry());
    expect(
      anchors.find((item) => item.id === labelHandleId("A") && item.kind === "text"),
    ).toEqual({
      id: labelHandleId("A"),
      kind: "text",
      x_mm: ax + LABEL_DX_MM,
      y_mm: ay + LABEL_DY_MM,
      text: "A",
      size_mm: 1.6,
      owner: "A",
    });
  });

  it("hits A:label on the letter, away from the point mark", () => {
    const [ax, ay] = pageOf(fixtureDoc, "A");
    const [lx, ly] = labelCenter(ax, ay);
    expect(hitFigure(fixtureDoc, "tri", lx, ly, registry())).toBe(
      labelHandleId("A"),
    );
  });

  it("still hits the point mark itself", () => {
    const [ax, ay] = pageOf(fixtureDoc, "A");
    expect(hitFigure(fixtureDoc, "tri", ax, ay, registry())).toBe("A");
  });

  it("keeps the mark HUD and drops the label when A is hidden", () => {
    const hidden = patchField(
      fixtureDoc,
      "tri",
      { id: "A", key: "show", value: false },
      registry(),
    );
    const [ax, ay] = pageOf(hidden, "A");
    const ids = listAnchors(hidden, "tri", registry()).map((item) => item.id);
    expect(ids).toContain("A");
    expect(ids).not.toContain(labelHandleId("A"));
    expect(hitFigure(hidden, "tri", ax, ay, registry())).toBe("A");
    const [lx, ly] = labelCenter(ax, ay);
    expect(hitFigure(hidden, "tri", lx, ly, registry())).not.toBe(
      labelHandleId("A"),
    );
  });

  it("moves the text anchor when labelAngle is 180", () => {
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: "A", key: "labelAngle", value: 180 },
      registry(),
    );
    const [ax, ay] = pageOf(next, "A");
    const text = listAnchors(next, "tri", registry()).find(
      (item) => item.id === labelHandleId("A") && item.kind === "text",
    );
    const [dx, dy] = labelOffsetMm(180, "A");
    expect(text && text.kind === "text" ? text.x_mm : 0).toBeCloseTo(ax + dx);
    expect(text && text.kind === "text" ? text.y_mm : 0).toBeCloseTo(ay + dy);
  });
});
