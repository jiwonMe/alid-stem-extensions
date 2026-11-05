/**
 * 등식 한 줄 → explicit / implicit AST.
 * GeoDef 를 모른다. y=f(x)·x=g(y) 는 explicit(축만 다름). 둘 다 있는 식만 implicit.
 */
import { stemfigError } from "@stemfig/host";
import { parseAst, type Expr } from "./expr.ts";

const XY = new Set(["x", "y"]);

/** 독립 변수. x 면 y=f(x), y 면 x=g(y). */
export type ExplicitAlong = "x" | "y";

/** y = f(x) / x = g(y) 또는 F(x,y) = 0. */
export type Equation =
  | { kind: "explicit"; f: Expr; along: ExplicitAlong }
  | { kind: "implicit"; F: Expr };

/**
 * `=` 가 없으면 expr = 0. `=` 가 둘 이상이면 BAD_FN.
 * 한쪽이 변수 하나이고 다른 쪽에 그 변수가 없으면 explicit.
 * y 가 고립이면 along=x, x 가 고립이면 along=y. 둘 다 아니면 implicit.
 * @param src 패널·def 원문
 * @param path StemfigValidationError.path
 * @throws BAD_FN 파싱 실패
 */
export function parseEquation(src: string, path: string): Equation {
  const parts = splitEq(src);
  if (parts.length > 2) {
    throw stemfigError("BAD_FN", path, "too many =");
  }
  if (parts.length === 1) {
    return { kind: "implicit", F: parseAst(parts[0]!, path, XY) };
  }
  const lhs = parseAst(parts[0]!, path, XY);
  const rhs = parseAst(parts[1]!, path, XY);
  const along = isolatedAlong(lhs, rhs);
  if (along) {
    const f = isVar(lhs, along === "x" ? "y" : "x") ? rhs : lhs;
    return { kind: "explicit", f, along };
  }
  return { kind: "implicit", F: { t: "bin", op: "-", l: lhs, r: rhs } };
}

/**
 * 고립된 종속 변수 → 독립 축. y=… 이면 x, x=… 이면 y.
 * 양쪽에 같은 변수가 있으면(x = sin(x)+y) 고립이 아니므로 undefined.
 */
function isolatedAlong(lhs: Expr, rhs: Expr): ExplicitAlong | undefined {
  if (isVar(lhs, "y") && !hasVar(rhs, "y")) {
    return "x";
  }
  if (isVar(rhs, "y") && !hasVar(lhs, "y")) {
    return "x";
  }
  if (isVar(lhs, "x") && !hasVar(rhs, "x")) {
    return "y";
  }
  if (isVar(rhs, "x") && !hasVar(lhs, "x")) {
    return "y";
  }
  return undefined;
}

/**
 * 패널 쓰기 전. throw 하지 않는다.
 */
export function equationOk(src: string): boolean {
  try {
    parseEquation(src, "fn");
    return true;
  } catch {
    return false;
  }
}

function splitEq(src: string): string[] {
  /* 빈 가운데 항도 남겨야 y==x 를 y=x 로 오인하지 않는다. 등호는 하나만 허용한다. */
  return src.split("=").map((part) => part.trim());
}

function isVar(expr: Expr, name: string): boolean {
  return expr.t === "var" && expr.name === name;
}

function hasVar(expr: Expr, name: string): boolean {
  switch (expr.t) {
    case "num":
      return false;
    case "var":
      return expr.name === name;
    case "un":
    case "call":
      return hasVar(expr.e, name);
    case "bin":
      return hasVar(expr.l, name) || hasVar(expr.r, name);
  }
}
