/**
 * zod v3 스키마를 모양으로만 걷는다. 객체·배열·튜플·합집합과 그 래퍼.
 * 호스트는 spec 의 뜻을 모른다. 키 이름이나 리터럴 값의 의미로 분기하지 않는다.
 * instanceof 대신 _def.typeName 문자열을 본다. 플러그인 패키지가 zod 사본을 따로 들고 와도
 * typeName 은 같기 때문이다. zod v3(^3.25) 내부 def 모양에 묶여 있으므로 메이저를 올리면 여기부터 고친다.
 * 진단(check)과 문법(grammar)만 쓴다. compile 경로는 이 파일을 거치지 않는다.
 */
import type { ZodTypeAny } from "zod";

/** 경로 한 칸. zod issue.path 와 같은 모양. */
export type PathKey = string | number;

/** zod 내부 def. 타입 없는 읽기는 이 파일 안에서만 한다. */
type AnyDef = Record<string, unknown> & { typeName?: string };

/** lazy 가 자기 자신을 다시 돌려주는 스키마에서 무한히 벗기지 않게 하는 상한. */
const MAX_UNWRAP = 32;

/**
 * @param schema 아무 zod 스키마
 * @returns 내부 def. zod 공개 타입에 없는 필드를 읽기 위한 한 곳
 */
export function defOf(schema: ZodTypeAny): AnyDef {
  return schema._def as AnyDef;
}

/**
 * @param schema 아무 zod 스키마
 * @returns ZodObject·ZodUnion 같은 내부 이름. 모르면 빈 문자열
 */
export function typeNameOf(schema: ZodTypeAny): string {
  return defOf(schema).typeName ?? "";
}

/**
 * 값 모양을 바꾸지 않는 래퍼 한 겹을 벗긴다.
 * Effects 는 refine·transform 을 버리고 입력 스키마만 본다. 문법은 입력 JSON 을 설명하기 때문이다.
 * @returns 래퍼가 아니면 undefined
 */
export function innerOf(schema: ZodTypeAny): ZodTypeAny | undefined {
  const def = defOf(schema);
  switch (def.typeName) {
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
    case "ZodReadonly":
    case "ZodCatch":
      return def.innerType as ZodTypeAny;
    case "ZodEffects":
      return def.schema as ZodTypeAny;
    case "ZodBranded":
      return def.type as ZodTypeAny;
    case "ZodLazy":
      return (def.getter as () => ZodTypeAny)();
    case "ZodPipeline":
      return def.in as ZodTypeAny;
    default:
      return undefined;
  }
}

/**
 * 래퍼를 전부 벗긴다.
 * @returns 객체·배열·튜플·합집합·원시형 같은 값 모양 스키마
 */
export function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
  let current = schema;
  for (let depth = 0; depth < MAX_UNWRAP; depth += 1) {
    const inner = innerOf(current);
    if (!inner) {
      return current;
    }
    current = inner;
  }
  return current;
}

/**
 * @returns ZodObject 의 필드 표. 다른 모양이면 undefined
 */
export function shapeOf(schema: ZodTypeAny): Record<string, ZodTypeAny> | undefined {
  const def = defOf(schema);
  if (def.typeName !== "ZodObject") {
    return undefined;
  }
  return (def.shape as () => Record<string, ZodTypeAny>)();
}

/**
 * @returns ZodUnion·ZodDiscriminatedUnion 의 갈래. 순서는 선언 순서이자 zod unionErrors 순서
 */
export function optionsOf(schema: ZodTypeAny): readonly ZodTypeAny[] | undefined {
  const def = defOf(schema);
  if (def.typeName === "ZodUnion" || def.typeName === "ZodDiscriminatedUnion") {
    return def.options as readonly ZodTypeAny[];
  }
  return undefined;
}

/**
 * 래퍼 없는 리터럴만 꼬리표로 본다. optional 리터럴은 갈래를 가르지 못한다.
 * @returns 리터럴이면 그 값을 담은 상자. 아니면 undefined
 */
export function literalOf(schema: ZodTypeAny): { value: unknown } | undefined {
  const def = defOf(schema);
  return def.typeName === "ZodLiteral" ? { value: def.value } : undefined;
}

/**
 * 값이 이 갈래의 꼬리표와 맞는가.
 * 튜플은 첫 칸 리터럴, 객체는 리터럴 필드 전부를 비교한다. 꼬리표가 없는 갈래는 false.
 * 작도 이름 같은 뜻은 모른 채 리터럴 비교만 한다.
 * @param option 합집합 한 갈래
 * @param value 그 자리의 입력 JSON
 */
export function tagMatches(option: ZodTypeAny, value: unknown): boolean {
  const inner = unwrapSchema(option);
  const def = defOf(inner);
  if (def.typeName === "ZodTuple") {
    const head = (def.items as ZodTypeAny[])[0];
    const literal = head ? literalOf(head) : undefined;
    return Array.isArray(value) && literal !== undefined && literal.value === value[0];
  }
  const shape = shapeOf(inner);
  if (!shape || !isRecord(value)) {
    return false;
  }
  const tags = Object.entries(shape).flatMap(([key, field]) => {
    const literal = literalOf(field);
    return literal ? [{ key, value: literal.value }] : [];
  });
  return tags.length > 0 && tags.every((tag) => value[tag.key] === tag.value);
}

/**
 * 입력에 맞는 갈래를 고른다. 통과하는 갈래가 먼저, 다음은 꼬리표가 맞는 갈래.
 * 둘 다 없으면 고르지 않는다. 아무 갈래나 추측해서 고르지 말 것.
 * @returns options 의 index. 못 고르면 undefined
 */
export function pickOption(options: readonly ZodTypeAny[], value: unknown): number | undefined {
  const passing = options.findIndex((option) => option.safeParse(value).success);
  if (passing >= 0) {
    return passing;
  }
  const tagged = options.findIndex((option) => tagMatches(option, value));
  return tagged >= 0 ? tagged : undefined;
}

/**
 * 경로 한 칸 아래 스키마. 합집합은 여기서 내려가지 않는다. 호출 측이 먼저 고른다.
 * @param schema 래퍼를 벗긴 스키마
 * @returns 없는 키거나 모르는 모양이면 undefined
 */
export function childOf(schema: ZodTypeAny, key: PathKey): ZodTypeAny | undefined {
  const def = defOf(schema);
  switch (def.typeName) {
    case "ZodObject": {
      /* hasOwn: 문서 키가 constructor·toString 이어도 Object.prototype 을 스키마로 착각하지 않게. */
      const shape = shapeOf(schema)!;
      const field = Object.hasOwn(shape, key) ? shape[String(key)] : undefined;
      if (field) {
        return field;
      }
      const catchall = def.catchall as ZodTypeAny | undefined;
      return catchall && typeNameOf(catchall) !== "ZodNever" ? catchall : undefined;
    }
    case "ZodArray":
      return isIndex(key) ? (def.type as ZodTypeAny) : undefined;
    case "ZodTuple": {
      if (!isIndex(key)) {
        return undefined;
      }
      const items = def.items as ZodTypeAny[];
      return items[Number(key)] ?? (def.rest as ZodTypeAny | null) ?? undefined;
    }
    case "ZodRecord":
      return def.valueType as ZodTypeAny;
    case "ZodIntersection":
      return childOf(unwrapSchema(def.left as ZodTypeAny), key) ??
        childOf(unwrapSchema(def.right as ZodTypeAny), key);
    default:
      return undefined;
  }
}

/**
 * 바로 아래 스키마 전부. 문법 출력이 이름 붙은 스키마를 미리 모을 때 그래프를 돈다.
 * 순환(lazy)은 호출 측이 방문 표로 끊는다.
 * @returns 래퍼 안쪽, 필드, 원소, 갈래. 원시형이면 빈 배열
 */
export function childrenOf(schema: ZodTypeAny): ZodTypeAny[] {
  const inner = innerOf(schema);
  if (inner) {
    return [inner];
  }
  const def = defOf(schema);
  switch (def.typeName) {
    case "ZodObject":
      return Object.values(shapeOf(schema) ?? {});
    case "ZodArray":
      return [def.type as ZodTypeAny];
    case "ZodTuple":
      return [...(def.items as ZodTypeAny[]), ...(def.rest ? [def.rest as ZodTypeAny] : [])];
    case "ZodUnion":
    case "ZodDiscriminatedUnion":
      return [...optionsOf(schema)!];
    case "ZodRecord":
      return [def.keyType as ZodTypeAny, def.valueType as ZodTypeAny];
    case "ZodIntersection":
      return [def.left as ZodTypeAny, def.right as ZodTypeAny];
    default:
      return [];
  }
}

/** schemaAt 의 갈래 선택. */
export type SchemaAtOptions = {
  /** 이미 고른 갈래. 키는 path 를 . 으로 이은 것. issue 변환이 채운다 */
  forced?: ReadonlyMap<string, number>;
  /**
   * 마지막 칸은 선언 그대로. 래퍼(optional·lazy)도 합집합도 풀지 않는다.
   * 문법 힌트가 이름(Node)과 수식어(`| null`)를 잃지 않게, 합집합 오류가 갈래 목록을 볼 수 있게.
   */
  declared?: boolean;
};

/**
 * 루트에서 path 를 따라 하위 스키마를 찾는다. 입력 값도 같이 내려가 합집합 갈래를 고른다.
 * 마지막 칸이 합집합이고 갈래를 못 고르면 합집합 자체를 돌려준다. 문법은 그 전체를 보여 준다.
 * @param root 플러그인 specSchema 또는 봉투 스키마
 * @param path zod issue.path 와 같은 경로
 * @param input root 에 넣은 입력 JSON
 * @param options 앞에서 고른 갈래, 마지막 합집합 보존
 * @returns 래퍼를 벗긴 스키마. 중간에 길을 잃으면 undefined
 */
export function schemaAt(
  root: ZodTypeAny,
  path: readonly PathKey[],
  input: unknown,
  options: SchemaAtOptions = {},
): ZodTypeAny | undefined {
  let schema: ZodTypeAny | undefined = root;
  let value: unknown = input;
  for (let index = 0; schema; index += 1) {
    if (index === path.length && options.declared) {
      return schema;
    }
    schema = resolveUnion(schema, value, path.slice(0, index).join("."), options.forced);
    if (index === path.length) {
      return schema;
    }
    const key = path[index]!;
    schema = childOf(schema, key);
    value = valueAt(value, key);
  }
  return undefined;
}

/**
 * 래퍼를 벗기고 합집합이면 갈래를 고른다. 못 고르면 합집합을 그대로 둔다.
 * 겹친 합집합은 forced 를 첫 겹에만 쓴다. 같은 경로 키가 두 겹을 가리키지 않게.
 */
function resolveUnion(
  schema: ZodTypeAny,
  value: unknown,
  key: string,
  forced: ReadonlyMap<string, number> | undefined,
): ZodTypeAny {
  let current = unwrapSchema(schema);
  let first = true;
  for (let depth = 0; depth < MAX_UNWRAP; depth += 1) {
    const options = optionsOf(current);
    if (!options) {
      return current;
    }
    const pick = (first ? forced?.get(key) : undefined) ?? pickOption(options, value);
    if (pick === undefined || !options[pick]) {
      return current;
    }
    current = unwrapSchema(options[pick]);
    first = false;
  }
  return current;
}

/**
 * @returns 객체 키나 배열 index 로 한 칸 내려간 값. 모양이 다르면 undefined
 */
export function valueAt(value: unknown, key: PathKey): unknown {
  if (Array.isArray(value) && isIndex(key)) {
    return value[Number(key)];
  }
  return isRecord(value) ? value[String(key)] : undefined;
}

/**
 * JSON 객체. 배열·null 은 아니다.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIndex(key: PathKey): boolean {
  return typeof key === "number" || /^\d+$/.test(key);
}
