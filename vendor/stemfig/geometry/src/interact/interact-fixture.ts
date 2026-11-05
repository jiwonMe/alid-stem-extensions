/**
 * 분리된 상호작용 회귀 테스트의 기본 삼각형 좌표.
 * 공용 harness 의 검증된 봉투를 재사용하며 테스트마다 registry 는 독립적이다.
 */
import { placeFigure, type Document } from "@stemfig/host";
import { baseDoc, registry, specOf, pageOf as mappedPoint, pageAt as mappedPosition } from "./test-harness.ts";

/** 기본 삼각형 테스트 문서. 테스트에서는 불변 편집 API만 쓴다. */
export const doc = baseDoc;
/** 독립 registry 와 spec 조회는 공용 harness 에서 제공한다. */
export { registry, specOf };

/** @param id 점 id @returns 기본 삼각형의 페이지 mm. 없는 점은 harness 가 오류를 낸다 */
export function pageOf(id: string): [number, number] { return mappedPoint(doc, id); }
/** @param x 수학 x @param y 수학 y @returns 기본 삼각형의 페이지 mm */
export function pageAt(x: number, y: number): [number, number] { return mappedPosition(doc, x, y); }

/** 반지름 4 원 위에서 기존 꼭짓점·변 스냅을 피하는 fixture 좌표. */
export const ON_CIRCLE_X = Math.sqrt(7);
/** x²+y²=16 을 만족하는 같은 fixture 의 y. */
export const ON_CIRCLE_Y = 3;

/** @returns 중심 A·원주 B 인 원을 실제 두 번의 배치 클릭으로 만든 문서 */
export function docWithCircle(): Document {
  const [ax, ay] = pageOf("A");
  const [bx, by] = pageOf("B");
  const first = placeFigure(doc, "tri", "circle", ax, ay, registry());
  return placeFigure(first.doc, "tri", "circle", bx, by, registry()).doc;
}
