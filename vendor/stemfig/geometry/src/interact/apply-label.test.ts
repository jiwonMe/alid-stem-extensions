/**
 * A:label 은 각·거리. k:label 은 변 거리·좌우. 호는 같이 간다.
 */
import { describe, expect, it } from "vitest";
import { applyFigure, listFields, patchField } from "@stemfig/host";
import { labelHandleId } from "../label-handle.ts";
import { LABEL_ANGLE_DEFAULT } from "../label-pos.ts";
import { SEG_ARC_SAGITTA_MM, segmentBow } from "../seg-label-arc.ts";
import {
  fixtureDoc,
  pageOf,
  registry,
  rightDoc,
  specOf,
} from "./test-harness.ts";

function arcLabelDoc() {
  const named = patchField(
    rightDoc,
    "rt",
    { id: "k", key: "label", value: "4" },
    registry(),
  );
  return patchField(
    named,
    "rt",
    { id: "k", key: "style", value: "arc" },
    registry(),
  );
}

describe("apply label pose", () => {
  it("moves angle and distance without moving point A", () => {
    const before = specOf(fixtureDoc).objects.find((obj) => obj.id === "A");
    const next = applyFigure(
      fixtureDoc,
      "tri",
      { id: labelHandleId("A"), dx_mm: -4, dy_mm: 0 },
      registry(),
    );
    const after = specOf(next).objects.find((obj) => obj.id === "A");
    expect(after?.def).toEqual(before?.def);
    expect(after?.labelAngle).not.toBe(before?.labelAngle ?? LABEL_ANGLE_DEFAULT);
    expect(after?.labelDistance).toBeGreaterThan(0);
  });

  it("lists caption fields for A:label without x y", () => {
    const rows = listFields(fixtureDoc, "tri", labelHandleId("A"), registry());
    expect(rows.find((row) => row.key === "x")).toBeUndefined();
    expect(rows.find((row) => row.key === "label")).toMatchObject({
      type: "text",
      value: "A",
    });
    expect(rows.find((row) => row.key === "labelAngle")).toMatchObject({
      type: "number",
      unit: "°",
    });
  });

  it("writes labelAngle through the A:label handle", () => {
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: labelHandleId("A"), key: "labelAngle", value: 180 },
      registry(),
    );
    expect(specOf(next).objects.find((obj) => obj.id === "A")?.labelAngle).toBe(
      180,
    );
  });

  it("ignores x patches on the A:label handle", () => {
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: labelHandleId("A"), key: "x", value: 9 },
      registry(),
    );
    expect(specOf(next).objects.find((obj) => obj.id === "A")?.def).toEqual(
      specOf(fixtureDoc).objects.find((obj) => obj.id === "A")?.def,
    );
  });

  it("moves the bow with the arc label and keeps A B", () => {
    const doc = arcLabelDoc();
    const before = specOf(doc);
    const [ax, ay] = pageOf(doc, "A");
    const [bx, by] = pageOf(doc, "B");
    const bow = segmentBow({ x: ax, y: ay }, { x: bx, y: by });
    const apex = bow![Math.floor(bow!.length / 2)]!;
    const dx = apex.x - (ax + bx) / 2;
    const dy = apex.y - (ay + by) / 2;
    const next = applyFigure(
      doc,
      "rt",
      { id: labelHandleId("k"), dx_mm: dx, dy_mm: dy },
      registry(),
    );
    const after = specOf(next);
    expect(after.objects.find((obj) => obj.id === "A")?.def).toEqual(
      before.objects.find((obj) => obj.id === "A")?.def,
    );
    expect(after.objects.find((obj) => obj.id === "B")?.def).toEqual(
      before.objects.find((obj) => obj.id === "B")?.def,
    );
    expect(after.marks?.[0]?.distance).toBeGreaterThan(
      before.marks?.[0]?.distance ?? SEG_ARC_SAGITTA_MM,
    );
  });

  it("flips the bow when the label crosses the segment", () => {
    const doc = arcLabelDoc();
    const [ax, ay] = pageOf(doc, "A");
    const [bx, by] = pageOf(doc, "B");
    const bow = segmentBow({ x: ax, y: ay }, { x: bx, y: by });
    const apex = bow![Math.floor(bow!.length / 2)]!;
    const next = applyFigure(
      doc,
      "rt",
      {
        id: labelHandleId("k"),
        dx_mm: 2 * ((ax + bx) / 2 - apex.x),
        dy_mm: 2 * ((ay + by) / 2 - apex.y),
      },
      registry(),
    );
    expect(specOf(next).marks?.[0]?.side).toBe("right");
  });

  it("lists distance and side for k:label without polar pose", () => {
    const rows = listFields(arcLabelDoc(), "rt", labelHandleId("k"), registry());
    expect(rows.find((row) => row.key === "labelAngle")).toBeUndefined();
    expect(rows.find((row) => row.key === "labelDistance")).toBeUndefined();
    expect(rows.find((row) => row.key === "label")).toMatchObject({
      type: "text",
      value: "4",
    });
    expect(rows.find((row) => row.key === "distance")).toMatchObject({
      type: "number",
      unit: "mm",
    });
    expect(rows.find((row) => row.key === "side")).toMatchObject({
      type: "enum",
      value: "left",
    });
  });

  it("writes distance through the k:label handle", () => {
    const next = patchField(
      arcLabelDoc(),
      "rt",
      { id: labelHandleId("k"), key: "distance", value: 5 },
      registry(),
    );
    expect(specOf(next).marks?.[0]?.distance).toBe(5);
  });
});
