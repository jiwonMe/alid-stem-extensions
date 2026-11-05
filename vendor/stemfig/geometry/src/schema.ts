/**
 * math.geometry@1 spec.
 * 호스트는 이 스키마를 모른다. specSchema 로만 검사한다.
 * 점 id 대문자, 선·원·다각형 id 소문자. on_path 는 점 id + 경로(선·원) id.
 * 호스트 figure.id 규칙과 별개.
 */
import { z } from "zod";
import { paintShape } from "./paint.ts";

const POINT_ID = /^[A-Z][A-Z0-9]*$/;
const EDGE_ID = /^[a-z][a-z0-9_]*$/;

/*
 * describe 는 문법 출력(stemfig schema)이 쓰는 이름표다. 파싱 결과는 바꾸지 않는다.
 * 같은 정규식이 수십 번 펼쳐지지 않고 PointId·PathId 로 한 번만 정의된다.
 */
const pointRef = z.string().regex(POINT_ID).describe("PointId");
const pathRef = z.string().regex(EDGE_ID).describe("PathId");

const geoDefSchema = z
  .object({
    ...paintShape,
    id: z.string(),
    /* 생략·true 는 그린다. false 만 숨긴다. 최상위 show[] 는 쓰지 않는다. */
    show: z.boolean().optional(),
    /* 점 라벨. 빈 문자열·생략은 안 그린다. 최상위 labels 맵은 쓰지 않는다. */
    label: z.string().optional(),
    /* 점 라벨 각. 0=오른쪽 반시계. 생략은 45 (우측 상단). 선은 무시. */
    labelAngle: z.number().min(0).max(360).optional(),
    /* 점↔bbox 변 거리 mm. 생략은 LABEL_GAP_MM. 선은 무시. */
    labelDistance: z.number().min(0).optional(),
    /* 점 원. 생략·true 는 그린다. false 면 라벨만. 선은 무시. */
    mark: z.boolean().optional(),
    def: z.union([
      z.tuple([z.literal("point"), z.number(), z.number()]),
      z.tuple([z.literal("on_path"), pathRef, z.number()]),
      z.tuple([z.literal("segment"), pointRef, pointRef]),
      z.tuple([z.literal("line"), pointRef, pointRef]),
      z.tuple([
        z.literal("division"),
        pointRef,
        pointRef,
        z.number().positive(),
        z.number().positive(),
        z.enum(["internal", "external"]),
      ]),
      z.tuple([
        z.literal("intersect"),
        pathRef,
        pathRef,
        z.number().int().nonnegative(),
      ]),
      z.tuple([z.literal("projection"), pointRef, pointRef, pointRef]),
      z.tuple([z.literal("circle"), pointRef, pointRef]),
      z.tuple([z.literal("parallel_line"), pointRef, pointRef, pointRef]),
      z.tuple([z.literal("perp_line"), pointRef, pointRef, pointRef]),
      z.tuple([
        z.literal("bisector"),
        pointRef,
        pointRef,
        pointRef,
        z.enum(["internal", "external"]),
      ]),
      z.tuple([z.literal("circumcircle"), pointRef, pointRef, pointRef]),
      z.tuple([z.literal("incircle"), pointRef, pointRef, pointRef]),
      z.tuple([z.literal("polygon")]).rest(pointRef),
      z.tuple([z.literal("graph"), z.string().min(1)]),
      z.tuple([z.literal("graph"), z.string().min(1), z.number(), z.number()]),
      z.tuple([z.literal("path"), z.string().min(1)]),
    ]),
  })
  .superRefine((obj, ctx) => {
    const head = obj.def[0];
    if (head === "graph" && obj.def.length === 4 && obj.def[2] === obj.def[3]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "graph domain is empty",
        path: ["def"],
      });
    }
    const asPoint =
      head === "point" ||
      head === "division" ||
      head === "on_path" ||
      head === "intersect" ||
      head === "projection";
    const ok = asPoint ? POINT_ID.test(obj.id) : EDGE_ID.test(obj.id);
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: asPoint
          ? "point id must match ^[A-Z][A-Z0-9]*$"
          : "edge id must match ^[a-z][a-z0-9_]*$",
        path: ["id"],
      });
    }
    if (head === "polygon" && obj.def.length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "polygon needs at least 3 points",
        path: ["def"],
      });
    }
    /* 외분 m===n 은 무한대. 기획 division_replace_midpoint. */
    if (head === "division" && obj.def[5] === "external" && obj.def[3] === obj.def[4]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "external division m===n is infinite",
        path: ["def"],
      });
    }
  });

/**
 * 도구 1클릭. compile 은 보지 않는다. 끝나면 지운다.
 * 2클릭은 from. 다각형은 vertices. 호스트는 이 키를 모른다.
 */
const pairDraftSchema = z.object({
  tool: z.enum([
    "segment",
    "circle",
    "line",
    "division",
    "perpendicular",
    "segment-annotation",
    "parallel-line",
    "perpendicular-line",
  ]),
  from: pointRef,
});

const intersectionDraftSchema = z.object({
  tool: z.literal("intersection"),
  path: pathRef,
});

const polygonDraftSchema = z.object({
  tool: z.literal("polygon"),
  vertices: z.array(pointRef).min(1),
});

/**
 * 점 3클릭. 1–2개만 draft. 세 번째는 place 가 끝낸다.
 */
const verticesDraftSchema = z.object({
  tool: z.enum([
    "angle-annotation",
    "angle-bisector",
    "circle-three-points",
    "circle-incircle",
  ]),
  vertices: z.array(pointRef).min(1).max(2),
});

const draftSchema = z
  .union([
    pairDraftSchema,
    intersectionDraftSchema,
    polygonDraftSchema,
    verticesDraftSchema,
  ])
  .optional();

const ticksSchema = z.number().int().min(1).max(3);

/**
 * 등각 그림. 없으면 겹호(arc). 교과 책마다 빈 원·점 원도 쓴다.
 */
const equalStyleSchema = z.enum(["arc", "circle", "dot"]);

/**
 * 변 그림. 없으면 수직 틱. circle 은 중점 빈 원 하나. arc 는 점선 호+라벨.
 */
const markStyleSchema = z.enum(["tick", "circle", "arc"]);

/**
 * 각 주석. objects 가 아니다. id 는 점·선과 겹치면 안 된다.
 * style 은 equal 만. 옛 JSON 에 없으면 겹호.
 * circle 은 빈 원 하나. ticks 값은 그려도 무시.
 */
const angleSchema = z.object({
  ...paintShape,
  id: z.string().regex(EDGE_ID),
  a: pointRef,
  v: pointRef,
  b: pointRef,
  mark: z.enum(["none", "right", "equal"]),
  style: equalStyleSchema.optional(),
  ticks: ticksSchema.optional(),
  label: z.string().optional(),
});

/**
 * 변 틱. 양 끝점만. segment 객체는 없어도 된다.
 * style 없으면 틱. circle·arc 는 ticks 를 그려도 무시.
 * distance·side 는 arc 만. 없으면 기본 높이·left.
 */
const markSchema = z.object({
  ...paintShape,
  id: z.string().regex(EDGE_ID),
  a: pointRef,
  b: pointRef,
  ticks: ticksSchema,
  style: markStyleSchema.optional(),
  /* 0.8·24 는 seg-label-arc SEG_ARC_SAGITTA_MIN/MAX. */
  distance: z.number().min(0.8).max(24).optional(),
  side: z.enum(["left", "right"]).optional(),
  label: z.string().optional(),
  /* 옛 JSON. 호 자리는 distance·side. 그리기·apply 는 안 본다. */
  labelAngle: z.number().min(0).max(360).optional(),
  labelDistance: z.number().min(0).optional(),
});

/** zod 와 GeometrySpec 을 한곳에서 맞춘다. 느슨한 any 금지. */
export const geometrySpecSchema = z
  .object({
    objects: z.array(geoDefSchema),
    angles: z.array(angleSchema).optional(),
    marks: z.array(markSchema).optional(),
    draft: draftSchema,
    /* 꼭짓점·교점 원. 생략·true 는 그린다. 객체 mark 와 AND. */
    markPoints: z.boolean().optional(),
  })
  .superRefine((spec, ctx) => {
    const seen = new Set<string>();
    for (const obj of spec.objects) {
      seen.add(obj.id);
    }
    for (const [index, item] of (spec.angles ?? []).entries()) {
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate id ${item.id}`,
          path: ["angles", index, "id"],
        });
      }
      seen.add(item.id);
    }
    for (const [index, item] of (spec.marks ?? []).entries()) {
      if (seen.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate id ${item.id}`,
          path: ["marks", index, "id"],
        });
      }
      seen.add(item.id);
    }
  });

/** 한 객체. def[0] 이 작도 종류. show·mark 생략은 그린다. label 생략은 안 그린다. */
export type GeoDef = z.infer<typeof geoDefSchema>;
/** parse 가 통과한 spec. 호스트에게는 unknown. */
export type GeometrySpec = z.infer<typeof geometrySpecSchema>;
/** objects 밖 각 주석. */
export type AngleAnnot = NonNullable<GeometrySpec["angles"]>[number];
/** 등각 그림. 없으면 arc. */
export type EqualStyle = NonNullable<AngleAnnot["style"]>;
/** objects 밖 변 틱. */
export type SegMark = NonNullable<GeometrySpec["marks"]>[number];
/** 변 그림. 없으면 tick. */
export type MarkStyle = NonNullable<SegMark["style"]>;

/**
 * compile 이 이 객체를 그릴지. 숨겨도 init 좌표는 남는다.
 * @param obj objects 한 줄
 * @returns false 가 아니면 true
 */
export function isShown(obj: GeoDef): boolean {
  return obj.show !== false;
}

/**
 * 점 GeoDef. 패널 Mark 행을 이 종류만 연다.
 * @param head obj.def[0]
 * @returns 좌표가 있는 다섯 종류면 true
 */
export function isPointDef(head: string): boolean {
  return (
    head === "point" ||
    head === "on_path" ||
    head === "division" ||
    head === "intersect" ||
    head === "projection"
  );
}

/**
 * 파생 직선·원. 점 GeoDef 가 아니다. 손잡이 역전파는 Phase 7.
 * @param head def[0]
 * @returns 다섯 파생 EDGE 면 true
 */
export function isDerivedEdge(head: string): boolean {
  return (
    head === "parallel_line" ||
    head === "perp_line" ||
    head === "bisector" ||
    head === "circumcircle" ||
    head === "incircle"
  );
}

/**
 * 식 곡선·SVG 경로. compile/hit 은 Path 로 푼다.
 * @param head def[0]
 */
export function isCurveEdge(head: string): boolean {
  return head === "graph" || head === "path";
}
