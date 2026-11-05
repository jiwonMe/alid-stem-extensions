import { describe, expect, it } from "vitest";
import { z, type ZodTypeAny } from "zod";
import { issuesToErrors } from "./zod-issues.ts";

const point = z.string().regex(/^[A-Z]+$/).describe("PointId");
const def = z.union([
  z.tuple([z.literal("point"), z.number(), z.number()]),
  z.tuple([z.literal("segment"), point, point]),
  z.tuple([z.literal("graph"), z.string()]),
  z.tuple([z.literal("graph"), z.string(), z.number(), z.number()]),
]);
const spec = z.object({ objects: z.array(z.object({ id: z.string(), def })) });

/** spec 하나를 safeParse 하고 SPEC 오류로 옮긴다. 경로 접두사는 문서 안 figure 자리. */
function errorsOf(schema: ZodTypeAny, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    return [];
  }
  return issuesToErrors(result.error.issues, {
    schema,
    input,
    code: "SPEC",
    prefix: ["nodes", 0, "children", 1, "spec"],
  });
}

describe("issuesToErrors", () => {
  it("follows the branch whose tag matches instead of reporting every branch", () => {
    const errors = errorsOf(spec, { objects: [{ id: "c", def: ["segment", "A", 3] }] });
    expect(errors).toEqual([
      {
        code: "SPEC",
        path: "nodes.0.children.1.spec.objects.0.def.2",
        message: "Expected string, received number",
        expected: "string /^[A-Z]+$/",
      },
    ]);
  });

  it("shows every accepted form when no tag matches", () => {
    const [error] = errorsOf(spec, { objects: [{ id: "m", def: ["midpoint", "A", "B"] }] });
    expect(error?.path).toBe("nodes.0.children.1.spec.objects.0.def");
    expect(error?.message).toBe('["midpoint","A","B"] matches none of the accepted forms');
    expect(error?.expected).toContain('| ["segment", PointId, PointId]');
    expect(error?.expected).toContain('| ["graph", string, number, number]');
  });

  it("shows only the forms that share the tag when arity is wrong", () => {
    const [error] = errorsOf(spec, { objects: [{ id: "f", def: ["graph", "x^2", 1] }] });
    expect(error?.expected).toBe('["graph", string] | ["graph", string, number, number]');
  });

  it("names the value that failed a pattern", () => {
    const [error] = errorsOf(spec, { objects: [{ id: "c", def: ["segment", "A", "b"] }] });
    expect(error?.message).toBe('"b" does not match the required pattern');
    expect(error?.path).toBe("nodes.0.children.1.spec.objects.0.def.2");
  });

  it("reports each unknown key of a strict object with a suggestion", () => {
    const strict = z.object({ label: z.string().optional(), name: z.string().optional() }).strict();
    expect(errorsOf(strict, { lable: "A" })).toEqual([
      {
        code: "SPEC",
        path: "nodes.0.children.1.spec.lable",
        message: 'unknown key "lable" (did you mean "label"?); allowed: label, name',
      },
    ]);
  });

  it("says Required when a union-typed field is missing", () => {
    const [error] = errorsOf(spec, { objects: [{ id: "c", deff: ["segment", "A", "B"] }] });
    expect(error).toMatchObject({ path: "nodes.0.children.1.spec.objects.0.def", message: "Required" });
  });

  it("does not trust zod's arity message when several forms share the tag", () => {
    const [error] = errorsOf(spec, { objects: [{ id: "f", def: ["graph", "x^2", 1, "y"] }] });
    expect(error?.message).toBe('["graph","x^2",1,"y"] matches none of the accepted forms');
    expect(error?.expected).toBe('["graph", string] | ["graph", string, number, number]');
  });

  it("keeps the arity message when only one form has the tag", () => {
    const [error] = errorsOf(spec, { objects: [{ id: "c", def: ["segment", "A"] }] });
    expect(error?.message).toBe("Array must contain at least 3 element(s)");
    expect(error?.expected).toBe('["segment", PointId, PointId]\n\nPointId = string /^[A-Z]+$/');
  });

  it("defines a recursive name once in a hint", () => {
    type Tree = { kind: "leaf" } | { kind: "node"; children: Tree[] };
    const tree: z.ZodType<Tree> = z.lazy(() =>
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("leaf") }).strict(),
        z.object({ kind: z.literal("node"), children: z.array(tree), note: z.string().max(4) }).strict(),
      ]),
    ).describe("Tree");
    const root = z.object({ root: tree });
    const [error] = errorsOf(root, { root: { kind: "node", note: 3 } });
    expect(error).toMatchObject({ path: "nodes.0.children.1.spec.root.children", message: "Required" });
    expect(error?.expected?.startsWith("Tree[]\n\nTree =")).toBe(true);
    expect(error?.expected?.match(/Tree =/g)).toHaveLength(1);
  });

  it("uses (root) for an issue at the root of an unprefixed schema", () => {
    const result = z.object({ a: z.number() }).safeParse(3);
    expect(result.success).toBe(false);
    if (!result.success) {
      const [error] = issuesToErrors(result.error.issues, { schema: z.object({ a: z.number() }), input: 3, code: "SCHEMA", prefix: [] });
      expect(error?.path).toBe("(root)");
    }
  });
});
