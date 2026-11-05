/**
 * fields / applyField. 좌표는 fixture 점 A, 선분 c, 내분점 M.
 */
import { describe, expect, it } from "vitest";
import { listFields, patchField } from "@stemfig/host";
import { initGeometry } from "../init.ts";
import { fixtureDoc, registry, specOf } from "./test-harness.ts";

describe("geometry fields", () => {
  it("lists free point A with editable x y, label, angle, distance, mark, and show", () => {
    const rows = listFields(fixtureDoc, "tri", "A", registry());
    expect(rows.find((row) => row.key === "x")).toMatchObject({
      type: "number",
      value: 0,
      disabled: false,
    });
    expect(rows.find((row) => row.key === "label")).toMatchObject({
      type: "text",
      value: "A",
    });
    expect(rows.find((row) => row.key === "labelAngle")).toMatchObject({
      type: "number",
      value: 45,
      unit: "°",
      min: 0,
      max: 360,
    });
    expect(rows.find((row) => row.key === "labelDistance")).toMatchObject({
      type: "number",
      unit: "mm",
      min: 0,
    });
    expect(rows.find((row) => row.key === "mark")).toMatchObject({
      type: "boolean",
      value: true,
    });
    expect(rows.find((row) => row.key === "show")).toMatchObject({
      type: "boolean",
      value: true,
    });
  });

  it("keeps division M coordinates read-only and exposes m n mode", () => {
    const rows = listFields(fixtureDoc, "tri", "M", registry());
    expect(rows.find((row) => row.key === "x")).toMatchObject({ disabled: true });
    expect(rows.find((row) => row.key === "y")).toMatchObject({ disabled: true });
    expect(rows.find((row) => row.key === "m")).toMatchObject({
      type: "number",
      value: 1,
      min: 1,
      disabled: false,
    });
    expect(rows.find((row) => row.key === "n")).toMatchObject({
      type: "number",
      value: 1,
      min: 1,
    });
    expect(rows.find((row) => row.key === "mode")).toMatchObject({
      type: "enum",
      value: "internal",
    });
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: "M", key: "x", value: 9 },
      registry(),
    );
    expect(initGeometry(specOf(next)).points.get("M")).toEqual(
      initGeometry(specOf(fixtureDoc)).points.get("M"),
    );
  });

  it("writes n=2 and recomputes M on AB", () => {
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: "M", key: "n", value: 2 },
      registry(),
    );
    expect(specOf(next).objects.find((obj) => obj.id === "M")?.def).toEqual([
      "division",
      "A",
      "B",
      1,
      2,
      "internal",
    ]);
    expect(initGeometry(specOf(next)).points.get("M")).toEqual({
      x: 4 / 3,
      y: 0,
    });
  });

  it("moves M outside AB when mode is external and m is 2", () => {
    const ratio = patchField(
      fixtureDoc,
      "tri",
      { id: "M", key: "m", value: 2 },
      registry(),
    );
    const next = patchField(
      ratio,
      "tri",
      { id: "M", key: "mode", value: "external" },
      registry(),
    );
    expect(specOf(next).objects.find((obj) => obj.id === "M")?.def).toEqual([
      "division",
      "A",
      "B",
      2,
      1,
      "external",
    ]);
    expect(initGeometry(specOf(next)).points.get("M")).toEqual({ x: 8, y: 0 });
  });

  it("keeps the document when m or n is not positive", () => {
    const neg = patchField(
      fixtureDoc,
      "tri",
      { id: "M", key: "m", value: -1 },
      registry(),
    );
    expect(specOf(neg).objects.find((obj) => obj.id === "M")?.def).toEqual([
      "division",
      "A",
      "B",
      1,
      1,
      "internal",
    ]);
    const zero = patchField(
      fixtureDoc,
      "tri",
      { id: "M", key: "n", value: 0 },
      registry(),
    );
    expect(specOf(zero).objects.find((obj) => obj.id === "M")?.def).toEqual([
      "division",
      "A",
      "B",
      1,
      1,
      "internal",
    ]);
  });

  it("keeps the document when external would be 1:1", () => {
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: "M", key: "mode", value: "external" },
      registry(),
    );
    expect(specOf(next).objects.find((obj) => obj.id === "M")?.def).toEqual([
      "division",
      "A",
      "B",
      1,
      1,
      "internal",
    ]);
  });

  it("writes point A x and recomputes M", () => {
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: "A", key: "x", value: 2 },
      registry(),
    );
    const spec = specOf(next);
    expect(spec.objects.find((obj) => obj.id === "A")?.def).toEqual([
      "point",
      2,
      0,
    ]);
    expect(initGeometry(spec).points.get("M")).toEqual({ x: 3, y: 0 });
  });

  it("keeps intersect G coordinates read-only and exposes index", () => {
    const rows = listFields(fixtureDoc, "tri", "G", registry());
    expect(rows.find((row) => row.key === "x")).toMatchObject({ disabled: true });
    expect(rows.find((row) => row.key === "index")).toMatchObject({
      type: "number",
      value: 0,
      min: 0,
    });
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: "G", key: "index", value: 1 },
      registry(),
    );
    expect(specOf(next).objects.find((obj) => obj.id === "G")?.def).toEqual([
      "intersect",
      "am",
      "bm",
      0,
    ]);
  });

  it("keeps projection H coordinates read-only", () => {
    const rows = listFields(fixtureDoc, "tri", "H", registry());
    expect(rows.find((row) => row.key === "x")).toMatchObject({ disabled: true });
    expect(rows.find((row) => row.key === "p")).toMatchObject({
      value: "C",
      disabled: true,
    });
  });

  it("toggles segment c show and label", () => {
    const rows = listFields(fixtureDoc, "tri", "c", registry());
    expect(rows.find((row) => row.key === "show")).toMatchObject({
      type: "boolean",
      value: true,
    });
    expect(rows.find((row) => row.key === "from")).toMatchObject({
      value: "A",
      disabled: true,
    });
    const hidden = patchField(
      fixtureDoc,
      "tri",
      { id: "c", key: "show", value: false },
      registry(),
    );
    expect(specOf(hidden).objects.find((obj) => obj.id === "c")?.show).toBe(
      false,
    );
    const named = patchField(
      hidden,
      "tri",
      { id: "c", key: "label", value: "AB" },
      registry(),
    );
    expect(specOf(named).objects.find((obj) => obj.id === "c")?.label).toBe("AB");
  });

  it("toggles point A show without dropping the object", () => {
    const hidden = patchField(
      fixtureDoc,
      "tri",
      { id: "A", key: "show", value: false },
      registry(),
    );
    expect(specOf(hidden).objects.find((obj) => obj.id === "A")?.show).toBe(
      false,
    );
    expect(specOf(hidden).objects.find((obj) => obj.id === "A")?.def[0]).toBe(
      "point",
    );
    const shown = patchField(
      hidden,
      "tri",
      { id: "A", key: "show", value: true },
      registry(),
    );
    expect(specOf(shown).objects.find((obj) => obj.id === "A")?.show).toBeUndefined();
  });

  it("toggles division M show", () => {
    const hidden = patchField(
      fixtureDoc,
      "tri",
      { id: "M", key: "show", value: false },
      registry(),
    );
    expect(specOf(hidden).objects.find((obj) => obj.id === "M")?.show).toBe(
      false,
    );
    expect(listFields(hidden, "tri", "M", registry()).find((row) => row.key === "show"))
      .toMatchObject({ value: false });
  });

  it("lists a point-mark toggle when no handle is focused", () => {
    const rows = listFields(fixtureDoc, "tri", undefined, registry());
    expect(rows.map((row) => row.key)).toEqual(["markPoints"]);
    expect(rows[0]).toMatchObject({ type: "boolean", value: true });
  });

  it("hides vertex and intersection marks on the figure without changing object mark", () => {
    const hidden = patchField(
      fixtureDoc,
      "tri",
      { id: "tri", key: "markPoints", value: false },
      registry(),
    );
    expect(specOf(hidden).markPoints).toBe(false);
    expect(specOf(hidden).objects.find((item) => item.id === "A")?.mark).not.toBe(
      false,
    );
    expect(
      listFields(hidden, "tri", undefined, registry()).find(
        (row) => row.key === "markPoints",
      ),
    ).toMatchObject({ value: false });
  });

  it("toggles point A mark without hiding the label", () => {
    const hidden = patchField(
      fixtureDoc,
      "tri",
      { id: "A", key: "mark", value: false },
      registry(),
    );
    const obj = specOf(hidden).objects.find((item) => item.id === "A");
    expect(obj?.mark).toBe(false);
    expect(obj?.label).toBe("A");
    expect(obj?.show).not.toBe(false);
  });

  it("writes point A labelAngle", () => {
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: "A", key: "labelAngle", value: 180 },
      registry(),
    );
    expect(specOf(next).objects.find((obj) => obj.id === "A")?.labelAngle).toBe(
      180,
    );
    expect(
      listFields(next, "tri", "A", registry()).find((row) => row.key === "labelAngle"),
    ).toMatchObject({ value: 180 });
  });

  it("writes point A labelDistance", () => {
    const next = patchField(
      fixtureDoc,
      "tri",
      { id: "A", key: "labelDistance", value: 4 },
      registry(),
    );
    expect(specOf(next).objects.find((obj) => obj.id === "A")?.labelDistance).toBe(
      4,
    );
  });
});
