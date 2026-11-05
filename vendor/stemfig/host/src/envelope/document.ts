/**
 * stemfig/v1 문서 봉투.
 * spec 내용은 검증하지 않는다. unknown 으로만 들고 플러그인 specSchema 에 맡긴다.
 * FigureKind 유니온을 여기에 두지 말 것. 구 page+figures 는 읽지 않는다.
 */
import { z } from "zod";
import { issuesToErrors } from "../check/zod-issues.ts";
import { axesSchema, gridSchema } from "./chrome.ts";
import { nodeColorSchema } from "./color.ts";
import { StemfigValidationError } from "./errors.ts";
import type { StemfigNode } from "./node.ts";

/** 봉투 식별자. 다른 값이면 SCHEMA throw. */
export const SCHEMA_ID = "stemfig/v1" as const;

/**
 * 포리스트. 최상위 부모는 root. 프레임은 root 에 여럿 올 수 있다.
 */
export type Document = {
  schema: typeof SCHEMA_ID;
  plugins: string[];
  /**
   * 라벨 조판. 없으면 upmath.
   * mathjax 만 로컬. upmath 는 앱이 hydrate 한다.
   */
  latex?: "mathjax" | "upmath";
  /**
   * 루트 캔버스(시트 밖) 속. 없으면 DEFAULT_CANVAS_FILL.
   * DisplayList 에 넣지 않는다. 에디터 셀이 읽는다.
   */
  color?: string;
  nodes: StemfigNode[];
};

const FIGURE_ID = /^[a-z][a-z0-9_]*$/;
const KIND = /^[a-z][a-z0-9_]+(\.[a-z][a-z0-9_]+)+$/;
const PLUGIN_REF = /^[a-z][a-z0-9_]+(\.[a-z][a-z0-9_]+)+@[1-9][0-9]*$/;

const frameSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

/**
 * figure 사용자 좌표 창. min < max. fitView 가 0 나눗셈을 만나지 않게.
 * 호스트가 교과를 아는 것이 아니다. 직사각형만 검사한다.
 */
const viewSchema = z
  .object({
    xmin: z.number(),
    xmax: z.number(),
    ymin: z.number(),
    ymax: z.number(),
    /* true 만 축마다 스케일. 없으면 양 축 동일. */
    stretch: z.boolean().optional(),
  })
  .refine((view) => view.xmin < view.xmax && view.ymin < view.ymax, {
    message: "view min must be less than max",
  });

const interactionSchema = z
  .object({
    handles: z.array(z.string()),
    invariants: z.array(z.string()),
  })
  .optional();

const figureSchema = z
  .object({
    id: z.string().regex(FIGURE_ID),
    type: z.literal("figure"),
    kind: z.string().regex(KIND),
    /* 시트와 같은 한 줄 라벨. 없으면 id. */
    name: z.string().min(1).max(80).optional(),
    /* 잉크. 없으면 DEFAULT_STYLE. */
    color: nodeColorSchema.optional(),
    locked: z.boolean().optional(),
    frame: frameSchema,
    /* SVG viewBox. 없으면 SCHEMA. spec 안에 두지 말 것. */
    view: viewSchema,
    /* 창 장식. 없으면 끈다. spec.grid 가 아니다. */
    grid: gridSchema.optional(),
    axes: axesSchema.optional(),
    spec: z.unknown(),
    interaction: interactionSchema,
  })
  .strict();

/*
 * z.unknown() 이 spec 을 optional 로 추론한다. Figure.spec 은 필수.
 * describe("Node") 는 문법 출력이 재귀를 이름으로 끊는 표시다. 파싱 결과는 바꾸지 않는다.
 */
const stemfigNodeSchema: z.ZodType<StemfigNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    figureSchema,
    z
      .object({
        id: z.string().regex(FIGURE_ID),
        type: z.literal("frame"),
        /* 80 은 시트 한 줄 라벨. 문장을 싣지 않는다. 없으면 id 를 보여 준다. */
        name: z.string().min(1).max(80).optional(),
        /* 시트 속. 없으면 흰 장. */
        color: nodeColorSchema.optional(),
        locked: z.boolean().optional(),
        frame: frameSchema,
        children: z.array(stemfigNodeSchema),
      })
      .strict(),
  ]),
).describe("Node") as z.ZodType<StemfigNode>;

/**
 * 봉투 전체. 파싱은 parseDocument 만 한다.
 * 호스트 안 check/grammar 가 문법 출력과 오류 자리 찾기에만 읽는다. index 로 내보내지 않는다.
 */
export const documentSchema = z
  .object({
    schema: z.literal(SCHEMA_ID),
    plugins: z.array(z.string().regex(PLUGIN_REF)),
    latex: z.enum(["mathjax", "upmath"]).optional(),
    /* 시트 밖 속. 없으면 에디터가 DEFAULT_CANVAS_FILL. */
    color: nodeColorSchema.optional(),
    nodes: z.array(stemfigNodeSchema),
  })
  .strict()
  .superRefine((doc, ctx) => refineTree(doc.nodes, ctx));

/**
 * 구조·id 정규식만 검사. frame 이 프레임 밖이어도 통과.
 * 실패 코드는 전부 SCHEMA. 경로·메시지·expected 변환은 figure spec 진단과 같은 issuesToErrors 를 쓴다.
 * strict 객체의 모르는 키는 키마다 한 건이고 경로 끝이 그 키다.
 * @param input 파싱 전 JSON. 구 page+figures 는 거절한다
 * @returns 검증된 포리스트
 * @throws StemfigValidationError
 */
export function parseDocument(input: unknown): Document {
  const result = documentSchema.safeParse(input);
  if (result.success) {
    return result.data as Document;
  }
  throw new StemfigValidationError(
    issuesToErrors(result.error.issues, { schema: documentSchema, input, code: "SCHEMA", prefix: [] }),
  );
}

/**
 * 구조 밖의 규칙. 예약된 id 는 없다. 프레임 개수도 세지 않는다.
 * 최상위 프레임이 하나도 없으면 캔버스 크기가 0 이 되므로 그것만 막는다.
 */
function refineTree(nodes: StemfigNode[], ctx: z.RefinementCtx): void {
  if (!nodes.some((node) => node.type === "frame")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "document.nodes must have at least one top-level frame",
      path: ["nodes"],
    });
  }
  const seen = new Set<string>();
  /* 새 문서는 빈 시트에서 시작한다. figure 유무는 봉투 유효성의 조건이 아니다. */
  visitIds(nodes, ["nodes"], seen, ctx);
}

function visitIds(
  nodes: StemfigNode[],
  prefix: Array<string | number>,
  seen: Set<string>,
  ctx: z.RefinementCtx,
): void {
  for (const [index, node] of nodes.entries()) {
    const path = [...prefix, index];
    if (seen.has(node.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate node id ${node.id}`,
        path: [...path, "id"],
      });
    }
    seen.add(node.id);
    if (node.type === "frame") {
      visitIds(node.children, [...path, "children"], seen, ctx);
    }
  }
}
