/**
 * 봉투 Node.color.
 * 상자 Frame 이 아니다. 시트 속·figure 잉크만.
 * #rgb / #rrggbb. 저장은 소문자 6자리.
 */
import { z } from "zod";

/**
 * Zod·setNodeColor 가 같은 식.
 * #rgb 또는 #rrggbb. 다른 CSS 색 이름은 거절.
 */
export const NODE_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * 파서용. 잘못된 값은 SCHEMA.
 * @returns #rrggbb
 */
export const nodeColorSchema = z
  .string()
  .regex(NODE_COLOR)
  .transform((raw) => expandHex(raw.toLowerCase()));

/**
 * 형식이 아니면 undefined. 빈 칸은 호출 측이 필드를 지운다.
 * @param raw 이미 trim 한 값
 * @returns #rrggbb
 */
export function parseNodeColor(raw: string): string | undefined {
  if (!NODE_COLOR.test(raw)) {
    return undefined;
  }
  return expandHex(raw.toLowerCase());
}

/**
 * #abc → #aabbcc. 길이는 호출 측이 이미 막았다.
 */
function expandHex(hex: string): string {
  if (hex.length === 7) {
    return hex;
  }
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}
