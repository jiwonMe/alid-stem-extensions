/**
 * interact 테스트 공용. fixture 좌표만. 케이스 복술은 각 파일.
 */
import { fitView } from "@stemfig/display";
import {
  figuresOf,
  parseDocument,
  Registry,
  type Document,
} from "@stemfig/host";
import rightFixture from "../../fixtures/right-triangle.stemfig.json";
import baseFixture from "../../fixtures/triangle-base.stemfig.json";
import fixture from "../../fixtures/triangle.stemfig.json";
import { mathGeometryPlugin } from "../index.ts";
import { initGeometry } from "../init.ts";
import { geometrySpecSchema, type GeometrySpec } from "../schema.ts";

/** 중선·교점·수선이 있는 교과 삼각형. G/H 테스트. */
export const fixtureDoc = parseDocument(fixture);

/**
 * A·B·C·M 만. 빈 곳·변 위 클릭 테스트.
 * 풀 fixture 는 H·중선이 (1,0) 을 가린다.
 */
export const baseDoc = parseDocument(baseFixture);

/** 직각 A, 변 틱. 마크 테스트. */
export const rightDoc = parseDocument(rightFixture);

/**
 * geometry 만 등록. 앱 registry 를 쓰지 않는다.
 */
export function registry(): Registry {
  const next = new Registry();
  next.register(mathGeometryPlugin);
  return next;
}

/**
 * 첫 figure spec. 테스트는 triangle 한 장만 연다.
 */
export function specOf(source: Document): GeometrySpec {
  return figuresOf(source)[0]!.spec as GeometrySpec;
}

/**
 * 파생점 포함, 수학 id → 페이지 mm.
 */
export function pageOf(source: Document, id: string): [number, number] {
  const figure = figuresOf(source)[0]!;
  const state = initGeometry(geometrySpecSchema.parse(specOf(source)));
  const { toLocal } = fitView(figure.view, figure.frame);
  const pt = state.points.get(id);
  if (!pt) {
    throw new Error(`missing ${id}`);
  }
  const [lx, ly] = toLocal(pt.x, pt.y);
  return [figure.frame.x + lx, figure.frame.y + ly];
}

/**
 * 수학 (x,y) → 페이지 mm. 빈 곳·둘레 클릭.
 */
export function pageAt(
  source: Document,
  vx: number,
  vy: number,
): [number, number] {
  const figure = figuresOf(source)[0]!;
  const { toLocal } = fitView(figure.view, figure.frame);
  const [lx, ly] = toLocal(vx, vy);
  return [figure.frame.x + lx, figure.frame.y + ly];
}
