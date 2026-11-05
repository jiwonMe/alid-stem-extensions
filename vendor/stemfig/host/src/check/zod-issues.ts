/**
 * zod issue → StemfigError. 봉투(parseDocument)와 figure spec(checkDocument)이 같은 변환을 쓴다.
 * 합집합 실패는 꼬리표가 맞는 갈래 하나로 좁혀 그 갈래의 오류만 낸다. zod 원본은 갈래마다 오류를 쏟아 낸다.
 * 못 좁히면 합집합 자리에 한 건만 내고 expected 에 받을 수 있는 꼴을 싣는다.
 * 정규식처럼 zod 메시지가 "Invalid" 뿐인 자리도 expected 가 무엇을 써야 하는지 보여 준다.
 * 키 찾기·추천은 zod-keys, 모양 읽기는 zod-walk 에 있다. 여기는 메시지와 힌트만 짠다.
 */
import { z, type ZodIssue, type ZodTypeAny } from "zod";
import type { StemfigError, StemfigErrorCode } from "../envelope/errors.ts";
import { describeSchema } from "./zod-describe.ts";
import { unknownKeyMessage } from "./zod-keys.ts";
import { optionsOf, schemaAt, shapeOf, tagMatches, unwrapSchema, valueAt, type PathKey } from "./zod-walk.ts";

/** 한 번의 safeParse 를 오류로 옮길 때 필요한 것. */
export type IssueScope = {
  /** safeParse 를 부른 스키마. 봉투 전체 또는 플러그인 specSchema */
  schema: ZodTypeAny;
  /** safeParse 에 넣은 입력. 합집합 갈래를 꼬리표로 고를 때 본다 */
  input: unknown;
  /** 봉투는 SCHEMA, figure spec 은 SPEC */
  code: StemfigErrorCode;
  /** 문서 루트부터 schema 자리까지의 경로. 봉투는 빈 배열, spec 은 nodes.0.children.1.spec */
  prefix: readonly PathKey[];
};

/* 이 길이를 넘는 문법은 오류 한 건에 싣지 않는다. 전체는 `stemfig schema <kind>` 가 보여 준다. */
const HINT_MAX = 2400;
/* 오류 힌트는 좁은 폭으로. JSON 문자열 안에서 줄이 짧아야 읽힌다. */
const HINT_WIDTH = 88;
/* 힌트에 붙이는 이름 정의 상한. PointId 같은 한 줄 정의는 싣고, 봉투 Node 처럼 큰 것은 이름만 남긴다. */
const HINT_DEFINITION_MAX = 400;
/*
 * zod 메시지가 무엇을 써야 하는지 말해 주지 않는 코드. 나머지(범위·enum·판별자)는 메시지에 값이 있다.
 * 배열 길이(too_small·too_big, type array)는 튜플 꼴을 보여 줘야 인자 개수를 고칠 수 있어 isArity 로 따로 본다.
 */
const WANTS_HINT = new Set(["invalid_type", "invalid_string", "invalid_literal"]);
/* 받은 값 미리보기 길이. 메시지 한 줄 안에서 어느 값인지만 알아보게. */
const PREVIEW_MAX = 60;

/**
 * 그 자리에 선언된 스키마와 합집합 갈래.
 * tagged 는 꼬리표(튜플 첫 칸·객체 리터럴 필드)가 입력과 맞는 갈래의 index.
 */
type Forms = {
  declared: ZodTypeAny;
  options?: readonly ZodTypeAny[];
  tagged: number[];
};

/**
 * @param issues safeParse 실패의 error.issues
 * @param scope 스키마·입력·코드·경로 접두사
 * @returns 문서 경로가 붙은 오류. 같은 경로·메시지는 한 번만
 */
export function issuesToErrors(issues: readonly ZodIssue[], scope: IssueScope): StemfigError[] {
  const out = issues.flatMap((issue) => convert(issue, scope, new Map()));
  const seen = new Set<string>();
  return out.filter((item) => {
    const key = `${item.path}\0${item.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * @param forced 앞에서 고른 합집합 갈래. 같은 issue 트리 안쪽 경로를 그 갈래로 따라가게 한다
 */
function convert(issue: ZodIssue, scope: IssueScope, forced: ReadonlyMap<string, number>): StemfigError[] {
  if (issue.code === "invalid_union") {
    return unionErrors(issue, scope, forced);
  }
  if (issue.code === "unrecognized_keys") {
    const target = schemaAt(scope.schema, issue.path, scope.input, { forced });
    const allowed = Object.keys((target && shapeOf(target)) ?? {});
    return issue.keys.map((key) => errorAt(scope, [...issue.path, key], unknownKeyMessage(key, allowed)));
  }
  const arity = isArity(issue);
  const forms = WANTS_HINT.has(issue.code) || arity ? formsAt(scope, issue.path, forced) : undefined;
  /*
   * zod 는 길이만 틀린 튜플 갈래를 '거의 맞음'으로 보고 첫 갈래의 길이 오류만 낸다.
   * 같은 꼬리표의 꼴이 여럿이면(["graph", f] 와 ["graph", f, a, b]) "at most 2" 는 틀린 말이다.
   */
  if (arity && forms && forms.tagged.length >= 2) {
    return [errorAt(scope, issue.path, noneMatched(valueAtPath(scope.input, issue.path)), hintOf(forms))];
  }
  return [errorAt(scope, issue.path, messageOf(issue, scope), hintOf(forms))];
}

function isArity(issue: ZodIssue): boolean {
  return (issue.code === "too_small" || issue.code === "too_big") && issue.type === "array";
}

/**
 * zod 기본 메시지를 그대로 쓰되, 정규식 실패의 "Invalid" 한 단어만 받은 값을 넣어 바꾼다.
 * 플러그인이 직접 준 메시지(refine 등)는 손대지 않는다.
 */
function messageOf(issue: ZodIssue, scope: IssueScope): string {
  if (issue.code === "invalid_string" && issue.validation === "regex" && issue.message === "Invalid") {
    return `${preview(valueAtPath(scope.input, issue.path))} does not match the required pattern`;
  }
  return issue.message;
}

/**
 * 꼬리표가 맞는 갈래가 하나면 그 갈래의 오류로 내려간다.
 * 둘 이상이면 그 갈래들만, 없으면 전부를 expected 로 보여 준다. 어느 쪽도 추측해서 고르지 않는다.
 */
function unionErrors(
  issue: Extract<ZodIssue, { code: "invalid_union" }>,
  scope: IssueScope,
  forced: ReadonlyMap<string, number>,
): StemfigError[] {
  const forms = formsAt(scope, issue.path, forced);
  const only = forms?.tagged.length === 1 ? forms.tagged[0]! : undefined;
  const branch = only !== undefined ? issue.unionErrors[only] : undefined;
  if (branch) {
    const next = new Map(forced).set(issue.path.join("."), only!);
    return branch.issues.flatMap((inner) => convert(inner, scope, next));
  }
  return [errorAt(scope, issue.path, noneMatched(valueAtPath(scope.input, issue.path)), hintOf(forms))];
}

/**
 * 어느 꼴에도 안 맞는 값. 값이 아예 없으면 zod 의 필드 누락과 같은 "Required".
 * "undefined matches none …" 은 빠진 필드라는 사실을 가린다.
 */
function noneMatched(value: unknown): string {
  return value === undefined ? "Required" : `${preview(value)} matches none of the accepted forms`;
}

function formsAt(scope: IssueScope, path: readonly PathKey[], forced: ReadonlyMap<string, number>): Forms | undefined {
  const declared = schemaAt(scope.schema, path, scope.input, { forced, declared: true });
  if (!declared) {
    return undefined;
  }
  const options = optionsOf(unwrapSchema(declared));
  if (!options) {
    return { declared, tagged: [] };
  }
  const value = valueAtPath(scope.input, path);
  return { declared, options, tagged: options.flatMap((option, index) => (tagMatches(option, value) ? [index] : [])) };
}

/**
 * 합집합이면 꼬리표가 맞는 갈래만. 맞는 갈래가 없거나 전부 맞으면 선언 그대로(이름·수식어 포함).
 */
function hintOf(forms: Forms | undefined): string | undefined {
  if (!forms) {
    return undefined;
  }
  const { declared, options, tagged } = forms;
  if (!options || tagged.length === 0 || tagged.length === options.length) {
    return hint(declared);
  }
  const shown = tagged.map((index) => options[index]!);
  return hint(shown.length >= 2 ? z.union(shown as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]) : shown[0]!);
}

/** 문법 한 덩어리. 너무 길면 싣지 않는다. */
function hint(schema: ZodTypeAny): string | undefined {
  const text = describeSchema(schema, { width: HINT_WIDTH, maxDefinition: HINT_DEFINITION_MAX });
  return text.length <= HINT_MAX ? text : undefined;
}

/** 메시지 안 받은 값. 길면 자른다. */
function preview(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length <= PREVIEW_MAX ? text : `${text.slice(0, PREVIEW_MAX - 1)}…`;
}

function valueAtPath(input: unknown, path: readonly PathKey[]): unknown {
  return path.reduce<unknown>((value, key) => valueAt(value, key), input);
}

function errorAt(scope: IssueScope, path: readonly PathKey[], message: string, expected?: string): StemfigError {
  const full = [...scope.prefix, ...path].join(".");
  return {
    code: scope.code,
    path: full || "(root)",
    message,
    ...(expected ? { expected } : {}),
  };
}
