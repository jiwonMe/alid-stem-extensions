/**
 * 스키마가 모르는 키 찾기와 오타 추천.
 * zod 기본(strip) 객체는 모르는 키를 오류 없이 지운다. 저자는 그림이 안 바뀌는 이유를 모른다.
 * 키 이름의 뜻은 모른다. 추천은 글자 거리만 본다.
 */
import type { ZodTypeAny } from "zod";
import { defOf, isRecord, schemaAt, shapeOf, typeNameOf, type PathKey } from "./zod-walk.ts";

/** 모르는 키 하나. path 의 마지막 칸이 그 키다. allowed 는 그 자리 객체가 받는 키. */
export type UnknownKey = { path: PathKey[]; allowed: string[] };

/**
 * 입력과 스키마만으로 strip 객체의 모르는 키를 찾는다. 파싱에 실패한 입력에도 쓴다.
 * 합집합은 schemaAt 처럼 통과하는 갈래, 다음은 꼬리표로 고른다. 못 고르면 그 아래는 보지 않는다.
 * strict 객체는 zod 가 이미 오류(unrecognized_keys)로 내고, passthrough·catchall 은 키를 지키므로 건너뛴다.
 * @param schema 봉투 스키마 또는 플러그인 specSchema
 * @param input 그 스키마에 넣는 JSON
 * @returns 입력 순서. 같은 키를 두 번 내지 않는다
 */
export function unknownKeys(schema: ZodTypeAny, input: unknown): UnknownKey[] {
  const out: UnknownKey[] = [];
  const visit = (value: unknown, path: PathKey[]) => {
    if (!Array.isArray(value) && !isRecord(value)) {
      return;
    }
    const target = schemaAt(schema, path, input);
    if (!target) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, index]));
      return;
    }
    const shape = shapeOf(target);
    const def = defOf(target);
    const catchall = def.catchall as ZodTypeAny | undefined;
    const strips = shape !== undefined && def.unknownKeys === "strip" && (!catchall || typeNameOf(catchall) === "ZodNever");
    for (const [key, item] of Object.entries(value)) {
      if (strips && !Object.hasOwn(shape, key)) {
        out.push({ path: [...path, key], allowed: Object.keys(shape) });
        continue;
      }
      visit(item, [...path, key]);
    }
  };
  visit(input, []);
  return out;
}

/**
 * strict 객체의 모르는 키 메시지.
 * @param allowed 그 자리 객체 스키마의 키. 못 찾으면 빈 배열
 */
export function unknownKeyMessage(key: string, allowed: readonly string[]): string {
  return `unknown key ${JSON.stringify(key)}${keyAdvice(key, allowed)}`;
}

/**
 * 모르는 키 뒤에 붙일 말. 오타 추천과 허용 키 목록.
 * @returns 앞 공백·구두점 포함. 둘 다 없으면 빈 문자열
 */
export function keyAdvice(key: string, allowed: readonly string[]): string {
  const guess = suggestKey(key, allowed);
  const hint = guess ? ` (did you mean ${JSON.stringify(guess)}?)` : "";
  return allowed.length > 0 ? `${hint}; allowed: ${allowed.join(", ")}` : hint;
}

/**
 * 오타로 보이는 키의 원래 이름. 대소문자·밑줄·하이픈을 뺀 뒤 글자 거리로 고른다.
 * @param key 문서에 적힌 키
 * @param candidates 그 자리에서 허용되는 키
 * @returns 충분히 가까운 후보. 없으면 undefined
 */
export function suggestKey(key: string, candidates: readonly string[]): string | undefined {
  const plain = (text: string) => text.replace(/[-_\s]/g, "").toLowerCase();
  const target = plain(key);
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = editDistance(target, plain(candidate));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  /* 세 글자에 한 번 틀린 정도까지만 오타로 본다. 더 멀면 다른 단어다. */
  return bestDistance <= Math.max(1, Math.floor(target.length / 3)) ? best : undefined;
}

/**
 * 이웃 글자 자리바꿈(lable→label)을 한 번으로 세는 편집 거리 (optimal string alignment).
 * 손 오타의 대부분이 바꿈·빠짐·자리바꿈이라 이것으로 충분하다.
 */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = best;
    }
  }
  return rows[a.length]![b.length]!;
}
