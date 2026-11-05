/**
 * GeoDef graph → Path. view 를 모른다.
 * y=f(x)·x=g(y) 는 explicit(along). 식 실패는 undefined. throw 하지 않아 패널이 남는다.
 */
import { parseEquation } from "../math/equation.ts";
import type { Path } from "../path.ts";
import type { GeoDef } from "../schema.ts";

/**
 * @param obj def[0]==="graph"
 * @returns 파싱 실패·빈 정의역이면 undefined
 */
export function graphPath(obj: GeoDef): Path | undefined {
  if (obj.def[0] !== "graph") {
    return undefined;
  }
  const x0 = obj.def.length === 4 ? obj.def[2] : undefined;
  const x1 = obj.def.length === 4 ? obj.def[3] : undefined;
  if (x0 !== undefined && x0 === x1) {
    return undefined;
  }
  try {
    const eq = parseEquation(obj.def[1], "fn");
    if (eq.kind === "explicit") {
      return { kind: "explicit", f: eq.f, x0, x1, along: eq.along };
    }
    return { kind: "implicit", F: eq.F, x0, x1 };
  } catch {
    return undefined;
  }
}
