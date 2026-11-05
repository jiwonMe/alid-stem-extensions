/**
 * 교재 포물선 8장이 기존 봉투로 열리고 유한한 SVG가 되는지 확인한다.
 * 그림의 물리 정답은 검증하지 않는다. 스키마와 참조만 통과하면 된다.
 */
import { renderSvg } from "@stemfig/display";
import { compileDocument, parseDocument, Registry } from "@stemfig/host";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/projectile.stemfig.json";
import { physicsMechanicsPlugin } from "./index.ts";

describe("projectile fixture", () => {
  it("compiles eight figures to a finite svg", () => {
    const doc = parseDocument(fixture);
    const registry = new Registry();
    registry.register(physicsMechanicsPlugin);
    const list = compileDocument(doc, registry);
    expect(list.frames).toHaveLength(1);
    expect(list.items.filter((item) => item.op === "group")).toHaveLength(8);
    const svg = renderSvg(list);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Noto Sans KR");
    expect(svg).not.toContain("NaN");
  });
});
