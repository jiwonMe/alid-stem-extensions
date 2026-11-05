/**
 * GeoDef path → bezier Path. d 는 view 좌표.
 * 파싱 실패는 undefined. throw 하지 않는다.
 */
import { parseD } from "../math/svg-path.ts";
import type { Path } from "../path.ts";
import type { GeoDef } from "../schema.ts";

/**
 * @param obj def[0]==="path"
 */
export function svgPathPath(obj: GeoDef): Path | undefined {
  if (obj.def[0] !== "path") {
    return undefined;
  }
  try {
    const segs = parseD(obj.def[1], "d");
    return segs.length > 0 ? { kind: "bezier", segs } : undefined;
  } catch {
    return undefined;
  }
}
