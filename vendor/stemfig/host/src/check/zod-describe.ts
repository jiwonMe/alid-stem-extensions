/**
 * zod 스키마 → 짧은 TypeScript 꼴 문법. 사람이나 LLM 이 spec 을 손으로 쓸 때 본다.
 * 리터럴·정규식·숫자 범위·길이는 스키마에서 그대로 옮긴다.
 * refine·superRefine 의 코드 규칙과 필드의 뜻은 옮기지 못한다. 스키마에 없는 설명을 지어내지 않는다.
 * 이름은 스키마 주인이 `.describe("PointRef")` 로 붙인 식별자만 쓴다. 호스트가 이름을 짓지 않는다.
 * 이름 붙은 하위 스키마는 이름으로 끊고, 정의는 맨 아래에 한 번만 적는다. lazy 재귀도 여기서 멈춘다.
 * 모양 읽기는 zod-walk 에만 둔다. 이 파일은 글자 배치만 한다.
 */
import type { ZodTypeAny } from "zod";
import { childrenOf, defOf, innerOf, optionsOf, shapeOf, typeNameOf, unwrapSchema } from "./zod-walk.ts";
import { json, keyword, lengthText, nativeEnumValues, numberText, stringText } from "./zod-text.ts";

/** 문법 출력 옵션. */
export type DescribeOptions = {
  /** 한 줄 최대 글자 수. 넘으면 여러 줄로 편다. */
  width?: number;
  /**
   * 이보다 긴 `Name = ...` 정의는 싣지 않는다. 오류 힌트가 봉투 Node 처럼 큰 정의를 매번 끌고 오지 않게.
   * 없으면 전부 싣는다 (schema 명령).
   */
  maxDefinition?: number;
};

/* active 는 지금 펼치는 중인 lazy. 이름 없는 재귀를 한 번만 펼치고 끊는다. */
type Ctx = { names: Map<ZodTypeAny, string>; width: number; active: Set<ZodTypeAny> };
type Field = { key: string; schema: ZodTypeAny };

/* 터미널 80칸에 들여쓰기 몇 단을 더해도 읽히는 폭. */
const DEFAULT_WIDTH = 96;
const INDENT = "  ";
/* 이름으로 쓰는 describe 문구. 문장형 설명은 이름이 아니므로 무시한다. */
const NAME = /^[A-Z][A-Za-z0-9]*$/;
/* 값 모양을 안 바꾸고 글자도 안 남기는 래퍼. Optional·Nullable·Default 는 글자로 남기므로 따로 다룬다. */
const TRANSPARENT = new Set(["ZodEffects", "ZodLazy", "ZodBranded", "ZodReadonly", "ZodCatch", "ZodPipeline"]);

/**
 * @param schema 플러그인 specSchema, 봉투 스키마, 또는 그 하위
 * @param options 줄 폭
 * @returns 본문 다음에 `Name = ...` 정의가 붙은 여러 줄 글자. 마지막 줄바꿈 없음
 */
export function describeSchema(schema: ZodTypeAny, options: DescribeOptions = {}): string {
  const ctx: Ctx = { names: collectNames(schema), width: options.width ?? DEFAULT_WIDTH, active: new Set() };
  /* 맨 위가 여러 줄 합집합이면 들여쓴 `| ` 줄로 시작한다. 정의 본문처럼 한 단 내어 쓴다. */
  const raw = layout(schema, "", ctx, true, false);
  const body = raw.startsWith("\n") ? raw.slice(1).replace(/^ {2}/gm, "") : raw;
  const blocks = [body];
  const done = new Set<string>([nameOf(schema, ctx) ?? ""]);
  const byName = new Map([...ctx.names].map(([item, name]) => [name, item]));
  /* 정의 안에서 새 이름이 나올 수 있다. 본문에 처음 나온 순서대로 닫힐 때까지 돈다. */
  for (let index = 0; index < blocks.length; index += 1) {
    for (const name of namesIn(blocks[index]!, byName)) {
      if (done.has(name)) {
        continue;
      }
      done.add(name);
      const text = layout(byName.get(name)!, "", ctx, true, false);
      const block = `${name} =${text.startsWith("\n") ? "" : " "}${text}`;
      if (block.length <= (options.maxDefinition ?? Number.POSITIVE_INFINITY)) {
        blocks.push(block);
      }
    }
  }
  return blocks.join("\n\n");
}

/**
 * describe 로 이름 붙은 스키마를 모은다.
 * zod 는 optional()/nullable() 이 안쪽 description 을 복사한다. 같은 이름의 가장 안쪽 겹만 등록한다.
 * 다른 스키마가 같은 이름을 쓰면 뒤에 숫자를 붙여 구분한다.
 */
function collectNames(root: ZodTypeAny): Map<ZodTypeAny, string> {
  const names = new Map<ZodTypeAny, string>();
  const taken = new Set<string>();
  const seen = new Set<ZodTypeAny>();
  const stack = [root];
  while (stack.length > 0) {
    const schema = stack.pop()!;
    if (seen.has(schema)) {
      continue;
    }
    seen.add(schema);
    const label = defOf(schema).description;
    if (typeof label === "string" && NAME.test(label)) {
      let owner = schema;
      for (let inner = innerOf(owner); inner && defOf(inner).description === label; inner = innerOf(owner)) {
        owner = inner;
      }
      if (!names.has(owner)) {
        let name = label;
        for (let suffix = 2; taken.has(name); suffix += 1) {
          name = `${label}${suffix}`;
        }
        taken.add(name);
        names.set(owner, name);
      }
    }
    stack.push(...childrenOf(schema).reverse());
  }
  return names;
}

/** 글자 안에 단어로 나온 이름들. 처음 나온 순서. */
function namesIn(text: string, byName: ReadonlyMap<string, ZodTypeAny>): string[] {
  const found = [...text.matchAll(/\b[A-Z][A-Za-z0-9]*\b/g)].map((match) => match[0]);
  return [...new Set(found.filter((word) => byName.has(word)))];
}

/**
 * 한 줄에 들어가면 한 줄, 아니면 여러 줄. 첫 줄은 호출 측이 놓고 나머지 줄은 indent 를 단다.
 * 여러 줄 합집합은 "\n" 으로 시작한다. 호출 측이 그 앞에 공백을 두지 않게 하려는 표시다.
 * @param top 맨 위. 이름이 있어도 펼친다
 * @param field 객체 필드 자리. optional 을 `?` 로 이미 적었으므로 `| undefined` 를 뺀다
 */
function layout(schema: ZodTypeAny, indent: string, ctx: Ctx, top: boolean, field: boolean): string {
  const one = flat(schema, ctx, top, field);
  if (indent.length + one.length <= ctx.width) {
    return one;
  }
  const def = defOf(schema);
  const inner = innerOf(schema);
  if (inner && TRANSPARENT.has(def.typeName ?? "")) {
    return guarded(schema, ctx, () => layout(inner, indent, ctx, top, field));
  }
  switch (def.typeName) {
    case "ZodOptional":
      return field ? layout(inner!, indent, ctx, top, field) : `${layout(inner!, indent, ctx, top, false)} | undefined`;
    case "ZodNullable":
      return `${layout(inner!, indent, ctx, top, false)} | null`;
    case "ZodDefault":
      return `${layout(inner!, indent, ctx, top, field)} (default ${json((def.defaultValue as () => unknown)())})`;
    case "ZodObject":
      return objectBlock(fieldsOf(schema), indent, ctx);
    case "ZodArray":
      return `Array<${wrapBlock(layout(def.type as ZodTypeAny, indent, ctx, false, false), indent)}>${lengthText(def)}`;
    case "ZodTuple":
      return tupleBlock(schema, indent, ctx);
    case "ZodUnion":
    case "ZodDiscriminatedUnion":
      return unionBlock(optionsOf(schema)!, indent, ctx);
    default:
      return one;
  }
}

/**
 * 한 줄 문법. 길이와 무관하게 늘 만든다. layout 이 폭을 보고 버릴지 정한다.
 */
function flat(schema: ZodTypeAny, ctx: Ctx, top: boolean, field: boolean): string {
  const name = top ? undefined : nameOf(schema, ctx);
  if (name) {
    return name;
  }
  const def = defOf(schema);
  const inner = innerOf(schema);
  if (inner && TRANSPARENT.has(def.typeName ?? "")) {
    return guarded(schema, ctx, () => flat(inner, ctx, top, field));
  }
  const child = (item: ZodTypeAny) => flat(item, ctx, false, false);
  switch (def.typeName) {
    case "ZodOptional":
      return field ? flat(inner!, ctx, top, field) : `${flat(inner!, ctx, top, false)} | undefined`;
    case "ZodNullable":
      return `${flat(inner!, ctx, top, false)} | null`;
    case "ZodDefault":
      return `${flat(inner!, ctx, top, field)} (default ${json((def.defaultValue as () => unknown)())})`;
    case "ZodString":
      return stringText(def);
    case "ZodNumber":
      return numberText(def);
    case "ZodLiteral":
      return json(def.value);
    case "ZodEnum":
      return (def.values as unknown[]).map(json).join(" | ");
    case "ZodNativeEnum":
      return nativeEnumValues(def.values as Record<string, unknown>).map(json).join(" | ");
    case "ZodArray": {
      const element = child(def.type as ZodTypeAny);
      return `${/^[\w"]+$/.test(element) ? `${element}[]` : `Array<${element}>`}${lengthText(def)}`;
    }
    case "ZodTuple": {
      const rest = def.rest as ZodTypeAny | null;
      const items = (def.items as ZodTypeAny[]).map(child);
      return `[${[...items, ...(rest ? [`...${child(rest)}[]`] : [])].join(", ")}]`;
    }
    case "ZodObject":
      return objectFlat(fieldsOf(schema), ctx);
    case "ZodUnion":
    case "ZodDiscriminatedUnion":
      return unionFlat(optionsOf(schema)!, ctx);
    case "ZodRecord":
      return `Record<${child(def.keyType as ZodTypeAny)}, ${child(def.valueType as ZodTypeAny)}>`;
    case "ZodIntersection":
      return `${child(def.left as ZodTypeAny)} & ${child(def.right as ZodTypeAny)}`;
    default:
      return keyword(def.typeName ?? "");
  }
}

/**
 * 이름 없는 lazy 가 자기 자신을 다시 만나면 `unknown` 으로 끊는다.
 * 이름을 붙이라는 신호다. 무한 재귀로 프로세스를 죽이지 않는다.
 */
function guarded(schema: ZodTypeAny, ctx: Ctx, render: () => string): string {
  if (typeNameOf(schema) !== "ZodLazy") {
    return render();
  }
  if (ctx.active.has(schema)) {
    return "unknown";
  }
  ctx.active.add(schema);
  try {
    return render();
  } finally {
    ctx.active.delete(schema);
  }
}

/**
 * 이름표. 글자를 남기지 않는 래퍼(lazy·effects 등)를 지나서만 찾는다.
 * optional·nullable·default 는 멈춘다. 그래야 `PointId | null` 처럼 수식어가 이름 밖에 남는다.
 */
function nameOf(schema: ZodTypeAny, ctx: Ctx): string | undefined {
  for (let current: ZodTypeAny | undefined = schema; current; current = innerOf(current)) {
    const name = ctx.names.get(current);
    if (name) {
      return name;
    }
    if (!TRANSPARENT.has(typeNameOf(current))) {
      return undefined;
    }
  }
  return undefined;
}

function fieldsOf(schema: ZodTypeAny): Field[] {
  return Object.entries(shapeOf(schema) ?? {}).map(([key, value]) => ({ key, schema: value }));
}

/** optional·default 필드는 `?`. 입력 JSON 에서 생략해도 되기 때문이다. */
function isOptionalField(schema: ZodTypeAny): boolean {
  for (let current: ZodTypeAny | undefined = schema; current; current = innerOf(current)) {
    const name = typeNameOf(current);
    if (name === "ZodOptional" || name === "ZodDefault") {
      return true;
    }
    if (name === "ZodLazy") {
      return false;
    }
  }
  return false;
}

function fieldHead(item: Field): string {
  const key = /^[A-Za-z_$][\w$]*$/.test(item.key) ? item.key : json(item.key);
  return `${key}${isOptionalField(item.schema) ? "?" : ""}:`;
}

function objectFlat(fields: Field[], ctx: Ctx): string {
  if (fields.length === 0) {
    return "{}";
  }
  return `{ ${fields.map((item) => `${fieldHead(item)} ${flat(item.schema, ctx, false, true)}`).join("; ")} }`;
}

function objectBlock(fields: Field[], indent: string, ctx: Ctx): string {
  const inner = indent + INDENT;
  const lines = fields.map((item) => {
    const value = layout(item.schema, inner, ctx, false, true);
    return `${inner}${fieldHead(item)}${value.startsWith("\n") ? "" : " "}${value}`;
  });
  return `{\n${lines.join("\n")}\n${indent}}`;
}

function tupleBlock(schema: ZodTypeAny, indent: string, ctx: Ctx): string {
  const def = defOf(schema);
  const inner = indent + INDENT;
  const items = (def.items as ZodTypeAny[]).map((item) => layout(item, inner, ctx, false, false));
  const rest = def.rest as ZodTypeAny | null;
  if (rest) {
    items.push(`...Array<${wrapBlock(layout(rest, inner, ctx, false, false), inner)}>`);
  }
  return `[\n${items.map((item) => `${inner}${item.replace(/^\n/, "")}`).join(",\n")}\n${indent}]`;
}

/**
 * 모든 갈래가 같은 필드 스키마(같은 참조)를 공유하면 한 번만 적는다.
 * `{ ...common, type: z.literal("x") }` 꼴을 짧게 보이려는 것이다. 키 이름은 보지 않는다.
 * @returns 공유 필드가 둘 이상일 때만. 아니면 undefined
 */
function commonFields(options: readonly ZodTypeAny[]): { common: Field[]; rest: Field[][] } | undefined {
  const shapes = options.map((option) => shapeOf(unwrapSchema(option)));
  if (options.length < 2 || shapes.some((shape) => !shape)) {
    return undefined;
  }
  const [first, ...others] = shapes as Record<string, ZodTypeAny>[];
  const common = Object.keys(first!).filter((key) => others.every((shape) => shape[key] === first![key]));
  if (common.length < 2) {
    return undefined;
  }
  const shared = new Set(common);
  return {
    common: common.map((key) => ({ key, schema: first![key]! })),
    rest: (shapes as Record<string, ZodTypeAny>[]).map((shape) =>
      Object.entries(shape).filter(([key]) => !shared.has(key)).map(([key, schema]) => ({ key, schema }))),
  };
}

function unionFlat(options: readonly ZodTypeAny[], ctx: Ctx): string {
  const factored = commonFields(options);
  if (factored) {
    const variants = factored.rest.map((fields) => objectFlat(fields, ctx)).join(" | ");
    return `${objectFlat(factored.common, ctx)} & (${variants})`;
  }
  return options.map((option) => flat(option, ctx, false, false)).join(" | ");
}

/** 여러 줄 합집합. 갈래마다 `| ` 한 줄. 첫 글자 "\n" 은 layout 의 약속을 따른다. */
function unionBlock(options: readonly ZodTypeAny[], indent: string, ctx: Ctx): string {
  const inner = indent + INDENT;
  const factored = commonFields(options);
  if (factored) {
    const variants = factored.rest.map((fields) => {
      const one = objectFlat(fields, ctx);
      return `${inner}| ${inner.length + 2 + one.length <= ctx.width ? one : objectBlock(fields, inner + INDENT, ctx)}`;
    });
    return `${objectBlock(factored.common, indent, ctx)} & (\n${variants.join("\n")}\n${indent})`;
  }
  /* 갈래 본문은 `| ` 뒤 글자에 줄을 맞춘다. 닫는 괄호가 `|` 보다 안쪽에 와야 갈래 경계가 보인다. */
  const lines = options.map((option) => `${inner}| ${layout(option, inner + INDENT, ctx, false, false).replace(/^\n/, "")}`);
  return `\n${lines.join("\n")}`;
}

/** 여러 줄 합집합을 괄호류 안에 넣을 때 닫는 괄호를 제 줄로 내린다. */
function wrapBlock(text: string, indent: string): string {
  return text.startsWith("\n") ? `${text}\n${indent}` : text;
}
