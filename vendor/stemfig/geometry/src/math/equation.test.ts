/** 수식 구문과 explicit/implicit 분류를 검증한다. 잘못된 입력을 자동 보정하지 않는다. */
import { describe, expect, it } from "vitest";
import { evalExpr } from "./expr.ts";
import { equationOk, parseEquation } from "./equation.ts";

describe("parseEquation", () => {
  it("treats y = sin(x) as explicit", () => {
    const eq = parseEquation("y = sin(x)", "fn");
    expect(eq.kind).toBe("explicit");
    if (eq.kind !== "explicit") {
      return;
    }
    expect(eq.along).toBe("x");
    expect(evalExpr(eq.f, 0, 0)).toBeCloseTo(0);
  });

  it("treats sin(x) = y as explicit", () => {
    const eq = parseEquation("sin(x) = y", "fn");
    expect(eq.kind).toBe("explicit");
    if (eq.kind === "explicit") {
      expect(eq.along).toBe("x");
    }
  });

  it("treats x^2 + y^2 = 3 as implicit", () => {
    const eq = parseEquation("x^2 + y^2 = 3", "fn");
    expect(eq.kind).toBe("implicit");
    if (eq.kind !== "implicit") {
      return;
    }
    expect(evalExpr(eq.F, Math.sqrt(3), 0)).toBeCloseTo(0);
  });

  it("treats a missing = as F = 0", () => {
    const eq = parseEquation("x^2 + y^2 - 1", "fn");
    expect(eq.kind).toBe("implicit");
    if (eq.kind !== "implicit") {
      return;
    }
    expect(evalExpr(eq.F, 1, 0)).toBeCloseTo(0);
  });

  it("treats x = sin(y) as explicit along y", () => {
    const eq = parseEquation("x = sin(1/y)", "fn");
    expect(eq.kind).toBe("explicit");
    if (eq.kind !== "explicit") {
      return;
    }
    expect(eq.along).toBe("y");
    expect(evalExpr(eq.f, 0, 1 / (Math.PI / 2))).toBeCloseTo(1);
  });

  it("keeps x^2 = y^2 implicit", () => {
    expect(parseEquation("x^2 = y^2", "fn").kind).toBe("implicit");
  });
});

describe("equationOk", () => {
  it("rejects implicit multiply and extra =", () => {
    expect(equationOk("2x = 1")).toBe(false);
    expect(equationOk("y = 1 = 2")).toBe(false);
    expect(equationOk("y==x")).toBe(false);
    expect(equationOk("y = = x")).toBe(false);
    expect(equationOk("y = sin(x)")).toBe(true);
  });
});
