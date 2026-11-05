/**
 * AST 편미분. GeoDef 를 모른다.
 * 접선 f′ 와 음함수 ∇F 만. 수치미분은 Path.tangentDir 의 후보다.
 */
import { evalExpr, parseAst, type Expr } from "./expr.ts";

const ZERO: Expr = { t: "num", v: 0 };
const ONE: Expr = { t: "num", v: 1 };

/**
 * ∂expr/∂wrt. abs 는 0 에서 0.
 * @param expr parseAst 결과
 * @param wrt functiongraph 는 x, 음함수는 x 또는 y
 */
export function diff(expr: Expr, wrt: "x" | "y"): Expr {
  switch (expr.t) {
    case "num":
      return ZERO;
    case "var":
      return expr.name === wrt ? ONE : ZERO;
    case "un":
      return { t: "un", e: diff(expr.e, wrt) };
    case "bin":
      return diffBin(expr, wrt);
    case "call":
      return diffCall(expr, wrt);
  }
}

/**
 * ∇F 가 0 이면 undefined. 접선을 그리지 않는다.
 */
export function gradF(
  fn: string,
  x: number,
  y: number,
): { dx: number; dy: number } | undefined {
  const ast = safeAst(fn);
  if (!ast) {
    return undefined;
  }
  const dx = evalExpr(diff(ast, "x"), x, y);
  const dy = evalExpr(diff(ast, "y"), x, y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx * dx + dy * dy < 1e-16) {
    return undefined;
  }
  return { dx, dy };
}

/**
 * f′(x). 없으면 undefined.
 */
export function derivAt(fn: string, x: number): number | undefined {
  const ast = safeAst(fn);
  if (!ast) {
    return undefined;
  }
  const d = evalExpr(diff(ast, "x"), x, 0);
  return Number.isFinite(d) ? d : undefined;
}

function safeAst(fn: string): Expr | undefined {
  try {
    return parseAst(fn, "fn", new Set(["x", "y"]));
  } catch {
    return undefined;
  }
}

function diffBin(
  expr: Extract<Expr, { t: "bin" }>,
  wrt: "x" | "y",
): Expr {
  const dl = diff(expr.l, wrt);
  const dr = diff(expr.r, wrt);
  if (expr.op === "+") {
    return { t: "bin", op: "+", l: dl, r: dr };
  }
  if (expr.op === "-") {
    return { t: "bin", op: "-", l: dl, r: dr };
  }
  if (expr.op === "*") {
    return {
      t: "bin",
      op: "+",
      l: { t: "bin", op: "*", l: dl, r: expr.r },
      r: { t: "bin", op: "*", l: expr.l, r: dr },
    };
  }
  if (expr.op === "/") {
    return {
      t: "bin",
      op: "/",
      l: {
        t: "bin",
        op: "-",
        l: { t: "bin", op: "*", l: dl, r: expr.r },
        r: { t: "bin", op: "*", l: expr.l, r: dr },
      },
      r: { t: "bin", op: "^", l: expr.r, r: { t: "num", v: 2 } },
    };
  }
  /* 상수 지수: n u^{n-1} u′. 일반식의 ln u 는 u=0 에서 NaN. */
  if (dr.t === "num" && dr.v === 0) {
    return {
      t: "bin",
      op: "*",
      l: expr.r,
      r: {
        t: "bin",
        op: "*",
        l: {
          t: "bin",
          op: "^",
          l: expr.l,
          r: { t: "bin", op: "-", l: expr.r, r: ONE },
        },
        r: dl,
      },
    };
  }
  /* u^v → u^v * (v' ln u + v u'/u) */
  return {
    t: "bin",
    op: "*",
    l: expr,
    r: {
      t: "bin",
      op: "+",
      l: {
        t: "bin",
        op: "*",
        l: dr,
        r: { t: "call", f: "ln", e: expr.l },
      },
      r: {
        t: "bin",
        op: "*",
        l: expr.r,
        r: { t: "bin", op: "/", l: dl, r: expr.l },
      },
    },
  };
}

function diffCall(
  expr: Extract<Expr, { t: "call" }>,
  wrt: "x" | "y",
): Expr {
  const de = diff(expr.e, wrt);
  const inner = expr.e;
  let outer: Expr;
  if (expr.f === "sin") {
    outer = { t: "call", f: "cos", e: inner };
  } else if (expr.f === "cos") {
    outer = { t: "un", e: { t: "call", f: "sin", e: inner } };
  } else if (expr.f === "tan") {
    const c = { t: "call" as const, f: "cos" as const, e: inner };
    outer = { t: "bin", op: "/", l: ONE, r: { t: "bin", op: "^", l: c, r: { t: "num", v: 2 } } };
  } else if (expr.f === "abs") {
    outer = { t: "bin", op: "/", l: inner, r: { t: "call", f: "abs", e: inner } };
  } else if (expr.f === "sqrt") {
    outer = {
      t: "bin",
      op: "/",
      l: { t: "num", v: 0.5 },
      r: { t: "call", f: "sqrt", e: inner },
    };
  } else if (expr.f === "exp") {
    outer = expr;
  } else {
    outer = { t: "bin", op: "/", l: ONE, r: inner };
  }
  return { t: "bin", op: "*", l: outer, r: de };
}
