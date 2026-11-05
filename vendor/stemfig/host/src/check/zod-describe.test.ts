import { describe, expect, it } from "vitest";
import { z } from "zod";
import { describeSchema } from "./zod-describe.ts";

describe("describeSchema", () => {
  it("keeps literals, patterns and numeric ranges from the schema", () => {
    const schema = z.object({
      id: z.string().regex(/^[a-z]+$/),
      name: z.string().min(1).max(80).optional(),
      angle: z.number().min(0).max(360),
      count: z.number().int().positive(),
      mode: z.enum(["a", "b"]),
      tag: z.literal("x"),
    });
    expect(describeSchema(schema)).toBe(
      "{\n" +
        "  id: string /^[a-z]+$/\n" +
        "  name?: string (len 1..80)\n" +
        "  angle: number [0, 360]\n" +
        "  count: int > 0\n" +
        '  mode: "a" | "b"\n' +
        '  tag: "x"\n' +
        "}",
    );
  });

  it("prints short shapes on one line", () => {
    const schema = z.object({ at: z.tuple([z.number(), z.number()]), tags: z.array(z.string()).min(1) });
    expect(describeSchema(schema)).toBe("{ at: [number, number]; tags: string[] (len >= 1) }");
  });

  it("lists union branches one per line when they do not fit", () => {
    const schema = z.union([
      z.tuple([z.literal("point"), z.number(), z.number()]),
      z.tuple([z.literal("segment"), z.string(), z.string()]),
      z.tuple([z.literal("polygon")]).rest(z.string()),
    ]);
    expect(describeSchema(schema, { width: 40 })).toBe(
      '| ["point", number, number]\n| ["segment", string, string]\n| ["polygon", ...string[]]',
    );
  });

  it("names schemas that their owner described and defines each name once", () => {
    const id = z.string().regex(/^[A-Z]+$/).describe("PointId");
    const schema = z.object({ a: id, b: id.optional(), list: z.array(id) });
    expect(describeSchema(schema)).toBe(
      "{ a: PointId; b?: PointId; list: PointId[] }\n\nPointId = string /^[A-Z]+$/",
    );
  });

  it("keeps modifiers outside a name", () => {
    const id = z.string().describe("Pid");
    expect(describeSchema(z.tuple([id, id.optional(), id.nullable(), id.default("A")]))).toBe(
      '[Pid, Pid | undefined, Pid | null, Pid (default "A")]\n\nPid = string',
    );
  });

  it("can leave out long definitions", () => {
    const big = z.object({ alpha: z.string(), beta: z.string(), gamma: z.string() }).describe("Big");
    expect(describeSchema(z.array(big), { maxDefinition: 10 })).toBe("Big[]");
  });

  it("writes fields shared by every variant once", () => {
    const common = { id: z.string(), label: z.string().optional() };
    const schema = z.discriminatedUnion("type", [
      z.object({ ...common, type: z.literal("box"), w: z.number() }),
      z.object({ ...common, type: z.literal("dot"), r: z.number() }),
    ]);
    expect(describeSchema(schema)).toBe(
      '{ id: string; label?: string } & ({ type: "box"; w: number } | { type: "dot"; r: number })',
    );
  });

  it("stops recursion at a named lazy schema", () => {
    type Tree = { children: Tree[] };
    const tree: z.ZodType<Tree> = z.lazy(() => z.object({ children: z.array(tree) })).describe("Tree");
    expect(describeSchema(z.object({ root: tree }))).toBe(
      "{ root: Tree }\n\nTree = { children: Tree[] }",
    );
  });

  it("cuts an unnamed recursion instead of looping forever", () => {
    type Tree = { children: Tree[] };
    const tree: z.ZodType<Tree> = z.lazy(() => z.object({ children: z.array(tree) }));
    /* 펼치는 중인 lazy 를 다시 만나면 그 자리에서 unknown. 이름을 붙이라는 신호다. */
    expect(describeSchema(tree)).toBe("{ children: unknown[] }");
  });
});
