/**
 * 편집 동작 계약. 삭제 후 참조 완결성·진행 취소·입력 실패 이유를 실제 엔진으로 검증한다.
 * 호스트를 거치는 케이스는 spec 을 해석하지 않는 위임과 잠금 보존도 확인한다.
 */
import { describe, expect, it } from "vitest";
import { cancelPlacement, figuresOf, listFields, patchField, placeFigure, removeHandles, toolGuidance, validateField, type Document } from "@stemfig/host";
import { initGeometry } from "../init.ts";
import { geometrySpecSchema, type GeometrySpec } from "../schema.ts";
import { removeGeometry } from "./remove.ts";
import { fixtureDoc, registry } from "./test-harness.ts";

const ctx = { frame: { x: 0, y: 0, w: 100, h: 100 }, view: { xmin: 0, xmax: 10, ymin: 0, ymax: 10 } };

const spec: GeometrySpec = {
  objects: [
    { id: "A", def: ["point", 0, 0], label: "A" },
    { id: "B", def: ["point", 4, 0] },
    { id: "C", def: ["point", 0, 4] },
    { id: "edge", def: ["segment", "A", "B"] },
    { id: "D", def: ["on_path", "edge", 0.5] },
    { id: "dependent", def: ["segment", "D", "C"] },
    { id: "curve", def: ["path", "M 0 0 L 1 1"] },
    { id: "graph", def: ["graph", "y=sin(x)"] },
  ],
  angles: [{ id: "angle", a: "A", v: "B", b: "C", mark: "equal" }],
  marks: [{ id: "mark", a: "C", b: "D", ticks: 1, label: "CD" }],
  draft: { tool: "segment", from: "A" },
};

function documentOf(value: GeometrySpec): Document {
  return { ...fixtureDoc, nodes: [{ id: "sheet", type: "frame", frame: ctx.frame, children: [
    { id: "tri", type: "figure", kind: "math.geometry", ...ctx, spec: value, interaction: { handles: ["A", "B", "C", "D"], invariants: [] } },
  ] }] };
}

describe("internal deletion", () => {
  it("deletes transitive dependents and both annotation kinds without damaging unrelated curves", () => {
    const before = initGeometry(spec);
    const result = removeGeometry(ctx, before, ["A:label"]);
    expect(result.state.spec.objects.map((obj) => obj.id)).toEqual(["B", "C", "curve", "graph"]);
    expect(result.state.spec.angles).toEqual([]);
    expect(result.state.spec.marks).toEqual([]);
    expect(result.state.spec.draft).toBeUndefined();
    expect(() => initGeometry(geometrySpecSchema.parse(result.state.spec))).not.toThrow();
    expect(before.spec).toBe(spec);
    expect(before.points.has("A")).toBe(true);
  });

  it("deleting an edge preserves its defining points; control aliases delete the whole path", () => {
    const state = initGeometry(spec);
    const next = removeGeometry(ctx, state, ["edge", "curve:c1"]).state;
    expect(next.spec.objects.map((obj) => obj.id)).toEqual(["A", "B", "C", "graph"]);
    expect(next.spec.angles).toHaveLength(1);
    expect(removeGeometry(ctx, state, ["missing"]).state).toBe(state);
  });

  it("annotation deletion preserves geometry and supports label aliases", () => {
    const next = removeGeometry(ctx, initGeometry(spec), ["angle", "mark:label"]).state.spec;
    expect(next.objects).toEqual(spec.objects);
    expect(next.angles).toEqual([]);
    expect(next.marks).toEqual([]);
  });

  it("host prunes deleted handles and respects inherited lock", () => {
    const doc = documentOf(spec);
    const next = removeHandles(doc, "tri", ["A"], registry());
    expect(figuresOf(next)[0]?.interaction?.handles).toEqual(["B", "C"]);
    const locked = { ...doc, nodes: doc.nodes.map((node) => ({ ...node, locked: true })) };
    expect(removeHandles(locked, "tri", ["A"], registry())).toBe(locked);
    expect(cancelPlacement(locked, "tri", registry())).toBe(locked);
  });

  it("prunes nonselected aliases belonging to removed objects", () => {
    const doc = documentOf(spec);
    figuresOf(doc)[0]!.interaction!.handles.push("A:label", "D:label", "curve:c0", "curve:c1");
    const next = removeHandles(doc, "tri", ["A", "curve"], registry());
    expect(figuresOf(next)[0]?.interaction?.handles).toEqual(["B", "C"]);
  });
});

describe("tool progress and invalid input", () => {
  it("reports next step then cancels draft without losing committed points", () => {
    const doc = documentOf(spec);
    expect(toolGuidance(doc, "tri", "segment", registry())).toEqual({ message: "두 번째 점을 선택하세요.", canCancel: true });
    const next = cancelPlacement(doc, "tri", registry());
    expect((figuresOf(next)[0]?.spec as GeometrySpec).draft).toBeUndefined();
    expect((figuresOf(next)[0]?.spec as GeometrySpec).objects).toEqual(spec.objects);
    expect(toolGuidance(next, "tri", "segment", registry())?.canCancel).toBe(false);
    expect(cancelPlacement(next, "tri", registry())).toBe(next);
  });

  it("returns the parser reason and keeps the original document for invalid equations", () => {
    const doc = documentOf(spec);
    const patch = { id: "graph", key: "eq", value: "y=sin(" };
    expect(validateField(doc, "tri", patch, registry())).toMatch(/입력 오류/);
    expect(patchField(doc, "tri", patch, registry())).toBe(doc);
    expect(validateField(doc, "tri", { ...patch, value: "y=x^2" }, registry())).toBeUndefined();
    expect(validateField(doc, "tri", { ...patch, value: "y==x" }, registry())).toMatch(/too many =/);
  });

  it("starts the newly selected tool independently after cancellation", () => {
    const doc = cancelPlacement(documentOf(spec), "tri", registry());
    const next = placeFigure(doc, "tri", "circle", 40, 100, registry()).doc;
    expect((figuresOf(next)[0]!.spec as GeometrySpec).draft).toEqual({ tool: "circle", from: "B" });
    expect(toolGuidance(next, "tri", "circle", registry())?.message).toBe("원을 지나는 점을 선택하세요.");
  });

  it("does not crash the property panel when imported object references are invalid", () => {
    const doc = documentOf({ objects: [{ id: "edge", def: ["segment", "A", "B"] }] });
    expect(listFields(doc, "tri", "edge", registry())).toEqual([]);
  });

  it("rejects numeric path data after close instead of looping forever", () => {
    const doc = documentOf(spec);
    expect(validateField(doc, "tri", { id: "curve", key: "d", value: "M 0 0 Z 3" }, registry())).toMatch(/missing command/);
  });
});
