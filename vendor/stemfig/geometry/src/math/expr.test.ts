import { describe, expect, it } from "vitest";
import { StemfigValidationError } from "@stemfig/host";
import { fnOk, parseFn, parseFn2 } from "./expr.ts";
import { derivAt, gradF } from "./diff.ts";

function expectBadFn(src: string): void {
  expect(() => parseFn(src, "fn")).toThrow(StemfigValidationError);
}

describe("parseFn", () => {
  it("evaluates sin(x) at 0", () => {
    expect(parseFn("sin(x)", "fn")(0)).toBeCloseTo(0);
  });

  it("treats ^ as right-associative", () => {
    expect(parseFn("2^3^2", "fn")(0)).toBe(512);
  });

  it("allows 2*x and rejects 2x", () => {
    expect(parseFn("2*x", "fn")(4)).toBe(8);
    expectBadFn("2x");
  });

  it("rejects unknown identifiers", () => {
    expectBadFn("alert(1)");
  });
});

describe("parseFn2", () => {
  it("evaluates x^2 + y^2 - 1", () => {
    const f = parseFn2("x^2 + y^2 - 1", "fn");
    expect(f(1, 0)).toBeCloseTo(0);
    expect(f(0, 0)).toBeCloseTo(-1);
  });

  it("rejects y in parseFn", () => {
    expectBadFn("y");
  });
});

describe("diff", () => {
  it("differentiates x^2", () => {
    expect(derivAt("x^2", 3)).toBeCloseTo(6);
  });

  it("gradients the unit circle", () => {
    const g = gradF("x^2 + y^2 - 1", 1, 0);
    expect(g?.dx).toBeCloseTo(2);
    expect(g?.dy).toBeCloseTo(0);
  });
});

describe("fnOk", () => {
  it("returns false for implicit multiply", () => {
    expect(fnOk("2x", "x")).toBe(false);
    expect(fnOk("sin(x)", "x")).toBe(true);
  });
});
