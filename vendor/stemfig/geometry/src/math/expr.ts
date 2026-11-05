/**
 * 식 AST 파서. GeoDef 를 모른다.
 * 암시 곱·미지 식별자는 BAD_FN. 호출 측이 잡아 그리지 않는다.
 * 호스트는 이 모듈을 모른다.
 */
import { stemfigError } from "@stemfig/host";

const FUNS = new Set(["sin", "cos", "tan", "abs", "sqrt", "exp", "ln"]);
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
const AST_CACHE_MAX = 64;

const astCache = new Map<string, Expr>();

/** 숫자·변수·단항·이항·호출. diff 가 이 모양만 본다. */
export type Expr =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "un"; e: Expr }
  | { t: "bin"; op: "+" | "-" | "*" | "/" | "^"; l: Expr; r: Expr }
  | { t: "call"; f: string; e: Expr };

type Tok =
  | { k: "num"; v: number }
  | { k: "id"; v: string }
  | { k: "op"; v: string }
  | { k: "end" };

/**
 * 허용 변수만 있는 AST. 캐시 키는 변수 집합+원문.
 * @param src 식 문자열
 * @param path StemfigValidationError.path. 예: fn
 * @param vars parseFn 은 x, parseFn2 는 x·y
 * @returns 평가 가능한 트리
 * @throws BAD_FN 암시 곱·미지 식별자·빈 식
 */
export function parseAst(src: string, path: string, vars: Set<string>): Expr {
  const key = `${[...vars].sort().join(",")}\0${src}`;
  const hit = astCache.get(key);
  if (hit) {
    astCache.delete(key);
    astCache.set(key, hit);
    return hit;
  }
  const ast = parseFresh(src, path, vars);
  astCache.set(key, ast);
  if (astCache.size > AST_CACHE_MAX) {
    const first = astCache.keys().next().value;
    if (first !== undefined) {
      astCache.delete(first);
    }
  }
  return ast;
}

/**
 * @param ast parseAst 결과
 * @param x 변수 x
 * @param y 변수 y. parseFn 은 0
 */
export function evalExpr(ast: Expr, x: number, y: number): number {
  switch (ast.t) {
    case "num":
      return ast.v;
    case "var":
      return ast.name === "y" ? y : x;
    case "un":
      return -evalExpr(ast.e, x, y);
    case "bin":
      return evalBin(ast, x, y);
    case "call":
      return evalCall(ast, x, y);
  }
}

/**
 * 변수 x 만. y 가 있으면 BAD_FN.
 * @returns (x) => 값
 */
export function parseFn(src: string, path: string): (x: number) => number {
  const ast = parseAst(src, path, new Set(["x"]));
  return (x) => evalExpr(ast, x, 0);
}

/**
 * 변수 x·y.
 * @returns (x, y) => 값
 */
export function parseFn2(
  src: string,
  path: string,
): (x: number, y: number) => number {
  const ast = parseAst(src, path, new Set(["x", "y"]));
  return (x, y) => evalExpr(ast, x, y);
}

/**
 * 패널 쓰기 전. throw 하지 않는다.
 * @param mode x 만이면 parseFn, xy 면 parseFn2
 */
export function fnOk(src: string, mode: "x" | "xy"): boolean {
  try {
    if (mode === "x") {
      parseFn(src, "fn");
    } else {
      parseFn2(src, "fn");
    }
    return true;
  } catch {
    return false;
  }
}

function parseFresh(src: string, path: string, vars: Set<string>): Expr {
  const toks = tokenize(src, path);
  let i = 0;
  const peek = () => toks[i] ?? { k: "end" as const };
  const eat = () => toks[i++] ?? { k: "end" as const };
  const fail = (msg: string): never => {
    throw stemfigError("BAD_FN", path, msg);
  };

  const isOp = (tok: Tok, v: string): tok is { k: "op"; v: string } =>
    tok.k === "op" && tok.v === v;

  const parseAdd = (): Expr => {
    let left = parseMul();
    while (isOp(peek(), "+") || isOp(peek(), "-")) {
      const op = (eat() as { k: "op"; v: "+" | "-" }).v;
      left = { t: "bin", op, l: left, r: parseMul() };
    }
    return left;
  };

  const parseMul = (): Expr => {
    let left = parsePow();
    while (isOp(peek(), "*") || isOp(peek(), "/")) {
      const op = (eat() as { k: "op"; v: "*" | "/" }).v;
      left = { t: "bin", op, l: left, r: parsePow() };
    }
    const next = peek();
    if (next.k === "num" || next.k === "id" || isOp(next, "(")) {
      fail("implicit multiply");
    }
    return left;
  };

  const parsePow = (): Expr => {
    const left = parseUnary();
    if (isOp(peek(), "^")) {
      eat();
      return { t: "bin", op: "^", l: left, r: parsePow() };
    }
    return left;
  };

  const parseUnary = (): Expr => {
    if (isOp(peek(), "-")) {
      eat();
      return { t: "un", e: parseUnary() };
    }
    if (isOp(peek(), "+")) {
      eat();
      return parseUnary();
    }
    return parsePrimary();
  };

  const parsePrimary = (): Expr => {
    const tok = eat();
    if (tok.k === "num") {
      return { t: "num", v: tok.v };
    }
    if (isOp(tok, "(")) {
      const inner = parseAdd();
      if (!isOp(peek(), ")")) {
        fail("expected )");
      }
      eat();
      return inner;
    }
    if (tok.k === "id") {
      return parseIdent(tok.v);
    }
    return fail("expected expression");
  };

  const parseIdent = (name: string): Expr => {
    if (isOp(peek(), "(")) {
      if (!FUNS.has(name)) {
        fail(`unknown identifier ${name}`);
      }
      eat();
      const arg = parseAdd();
      if (!isOp(peek(), ")")) {
        fail("expected )");
      }
      eat();
      return { t: "call", f: name, e: arg };
    }
    if (name in CONSTS) {
      return { t: "num", v: CONSTS[name]! };
    }
    if (!vars.has(name)) {
      fail(`unknown identifier ${name}`);
    }
    return { t: "var", name };
  };

  const ast = parseAdd();
  if (peek().k !== "end") {
    fail("trailing tokens");
  }
  return ast;
}

function tokenize(src: string, path: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const fail = (msg: string): never => {
    throw stemfigError("BAD_FN", path, msg);
  };
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if ("+-*/^()".includes(ch)) {
      out.push({ k: "op", v: ch });
      i += 1;
      continue;
    }
    if (isDigit(ch) || (ch === "." && isDigit(src[i + 1] ?? ""))) {
      const start = i;
      i = scanNumber(src, i);
      const v = Number(src.slice(start, i));
      if (!Number.isFinite(v)) {
        fail("bad number");
      }
      out.push({ k: "num", v });
      continue;
    }
    if (isLetter(ch)) {
      const start = i;
      i += 1;
      while (i < src.length && (isLetter(src[i]!) || isDigit(src[i]!))) {
        i += 1;
      }
      out.push({ k: "id", v: src.slice(start, i) });
      continue;
    }
    fail(`bad char ${ch}`);
  }
  out.push({ k: "end" });
  return out;
}

function scanNumber(src: string, start: number): number {
  let i = start;
  while (isDigit(src[i] ?? "")) {
    i += 1;
  }
  if (src[i] === "." && isDigit(src[i + 1] ?? "")) {
    i += 1;
    while (isDigit(src[i] ?? "")) {
      i += 1;
    }
  }
  if (src[i] === "e" || src[i] === "E") {
    let j = i + 1;
    if (src[j] === "+" || src[j] === "-") {
      j += 1;
    }
    if (isDigit(src[j] ?? "")) {
      i = j + 1;
      while (isDigit(src[i] ?? "")) {
        i += 1;
      }
    }
  }
  return i;
}

function evalBin(ast: Extract<Expr, { t: "bin" }>, x: number, y: number): number {
  const l = evalExpr(ast.l, x, y);
  const r = evalExpr(ast.r, x, y);
  if (ast.op === "+") {
    return l + r;
  }
  if (ast.op === "-") {
    return l - r;
  }
  if (ast.op === "*") {
    return l * r;
  }
  if (ast.op === "/") {
    return l / r;
  }
  return l ** r;
}

function evalCall(ast: Extract<Expr, { t: "call" }>, x: number, y: number): number {
  const a = evalExpr(ast.e, x, y);
  if (ast.f === "sin") {
    return Math.sin(a);
  }
  if (ast.f === "cos") {
    return Math.cos(a);
  }
  if (ast.f === "tan") {
    return Math.tan(a);
  }
  if (ast.f === "abs") {
    return Math.abs(a);
  }
  if (ast.f === "sqrt") {
    return Math.sqrt(a);
  }
  if (ast.f === "exp") {
    return Math.exp(a);
  }
  return Math.log(a);
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isLetter(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}
