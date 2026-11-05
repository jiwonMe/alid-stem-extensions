/**
 * DisplayList 는 mm. SVG·HUD·미리보기 시트만 CSS px 로 바꾼다.
 * 이 숫자를 바꾸면 에디터 HUD 와 WebGL 페이지가 다시 어긋난다.
 */

/** preview / editor 시트. 1mm = 4 CSS px. */
export const MM_TO_PX = 4;

/**
 * @param mm DisplayList 좌표
 * @returns HUD 와 같은 CSS px
 */
export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}
