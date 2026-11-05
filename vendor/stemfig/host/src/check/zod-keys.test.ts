import { describe, expect, it } from "vitest";
import { z } from "zod";
import { suggestKey, unknownKeys } from "./zod-keys.ts";

describe("unknownKeys", () => {
  const schema = z.object({
    objects: z.array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("dot"), r: z.number() }),
        z.object({ type: z.literal("box"), w: z.number() }),
      ]),
    ),
    strict: z.object({ a: z.number() }).strict().optional(),
    free: z.record(z.number()).optional(),
  });

  it("finds keys a stripping object would drop, inside the chosen union branch", () => {
    const found = unknownKeys(schema, { objects: [{ type: "box", w: 1, wdith: 2 }], show: true });
    expect(found).toEqual([
      { path: ["objects", 0, "wdith"], allowed: ["type", "w"] },
      { path: ["show"], allowed: ["objects", "strict", "free"] },
    ]);
  });

  it("still finds them when the value does not parse", () => {
    expect(unknownKeys(schema, { objects: [{ type: "dot", rr: 1 }] })).toEqual([
      { path: ["objects", 0, "rr"], allowed: ["type", "r"] },
    ]);
  });

  it("leaves strict objects, records and unresolved unions alone", () => {
    const input = { strict: { a: 1, b: 2 }, free: { any: 1 }, objects: [{ type: "ring", x: 1 }] };
    expect(unknownKeys(schema, input)).toEqual([]);
  });

  it("treats prototype names as ordinary keys", () => {
    expect(unknownKeys(schema, { objects: [], constructor: 1 })).toEqual([
      { path: ["constructor"], allowed: ["objects", "strict", "free"] },
    ]);
  });
});

describe("suggestKey", () => {
  it("counts a swap of neighbouring letters as one typo", () => {
    expect(suggestKey("lable", ["label", "mark"])).toBe("label");
  });

  it("ignores case, underscores and hyphens", () => {
    expect(suggestKey("label_angle", ["labelAngle", "label"])).toBe("labelAngle");
  });

  it("does not suggest a different word", () => {
    expect(suggestKey("show", ["objects", "angles", "marks"])).toBeUndefined();
  });
});
