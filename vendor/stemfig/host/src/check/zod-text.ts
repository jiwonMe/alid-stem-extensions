/**
 * 문법 글자의 잎 조각. 문자열·숫자 제약, 배열 길이, enum, 키워드.
 * zod 내부 check 모양(kind·value·inclusive)을 읽는다. 배치(줄 나눔)는 zod-describe 가 한다.
 * 스키마에 있는 제약만 옮긴다. 뜻을 덧붙이지 않는다.
 */

/**
 * @param def ZodString 의 def
 * @returns `string /re/ (len 1..80)` 꼴. 이메일 같은 형식 검사는 쓰지 않으므로 옮기지 않는다
 */
export function stringText(def: Record<string, unknown>): string {
  const checks = (def.checks as { kind: string; value?: number; regex?: RegExp }[] | undefined) ?? [];
  const regex = checks.find((check) => check.kind === "regex")?.regex;
  const length = rangeText(
    checks.find((check) => check.kind === "min")?.value,
    checks.find((check) => check.kind === "max")?.value,
    checks.find((check) => check.kind === "length")?.value,
  );
  return ["string", ...(regex ? [String(regex)] : []), ...(length ? [`(len ${length})`] : [])].join(" ");
}

/**
 * @param def ZodNumber 의 def
 * @returns `int > 0`, `number [0, 360]`, `number (-89, 89)` 꼴. finite 는 JSON 숫자라 늘 참이라 뺀다
 */
export function numberText(def: Record<string, unknown>): string {
  const checks = (def.checks as { kind: string; value?: number; inclusive?: boolean }[] | undefined) ?? [];
  const base = checks.some((check) => check.kind === "int") ? "int" : "number";
  const min = checks.filter((check) => check.kind === "min").at(-1);
  const max = checks.filter((check) => check.kind === "max").at(-1);
  if (min && max) {
    return `${base} ${min.inclusive ? "[" : "("}${min.value}, ${max.value}${max.inclusive ? "]" : ")"}`;
  }
  if (min) {
    return `${base} ${min.inclusive ? ">=" : ">"} ${min.value}`;
  }
  return max ? `${base} ${max.inclusive ? "<=" : "<"} ${max.value}` : base;
}

/**
 * @param def ZodArray 의 def
 * @returns 앞 공백 포함 ` (len >= 2)`. 길이 제한이 없으면 빈 문자열
 */
export function lengthText(def: Record<string, unknown>): string {
  const pick = (key: string) => (def[key] as { value: number } | null | undefined)?.value;
  const range = rangeText(pick("minLength"), pick("maxLength"), pick("exactLength"));
  return range ? ` (len ${range})` : "";
}

function rangeText(min: number | undefined, max: number | undefined, exact: number | undefined): string {
  if (exact !== undefined) {
    return String(exact);
  }
  if (min !== undefined && max !== undefined) {
    return `${min}..${max}`;
  }
  if (min !== undefined) {
    return `>= ${min}`;
  }
  return max !== undefined ? `<= ${max}` : "";
}

/**
 * 숫자 enum 은 역방향 키가 섞여 있다. 값 쪽만 남긴다.
 * @param values ZodNativeEnum 의 def.values
 */
export function nativeEnumValues(values: Record<string, unknown>): unknown[] {
  return Object.entries(values)
    .filter(([key]) => typeof values[values[key] as string] !== "number")
    .map(([, value]) => value);
}

/**
 * @param typeName 위 함수들이 다루지 않는 원시형
 * @returns TypeScript 키워드. 모르는 것은 Zod 접두사를 뗀 이름
 */
export function keyword(typeName: string): string {
  const plain: Record<string, string> = {
    ZodBoolean: "boolean",
    ZodNull: "null",
    ZodUndefined: "undefined",
    ZodUnknown: "unknown",
    ZodAny: "any",
    ZodNever: "never",
    ZodBigInt: "bigint",
    ZodDate: "Date",
    ZodVoid: "void",
  };
  return plain[typeName] ?? typeName.replace(/^Zod/, "").toLowerCase();
}

/**
 * 리터럴·키·기본값 표기. undefined 처럼 JSON 이 못 쓰는 값은 String 으로.
 */
export function json(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}
