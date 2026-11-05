/**
 * 도 단위 각도 격자.
 * 15° 같은 간격의 뜻은 플러그인이 고른다. 여기서는 나눗셈만 한다.
 * 물리량이나 시간으로 해석하지 않는다.
 */

/**
 * 도를 step 격자에 맞춘 뒤 (-180, 180] 로 접는다.
 * @param degrees 임의의 유한 각. 유한하지 않으면 그대로
 * @param step 격자 간격. 0 이하면 맞추지 않는다
 * @returns 격자 위의 도
 */
export function snapDegrees(degrees: number, step = 15): number {
  if (!Number.isFinite(degrees) || !(step > 0)) return degrees;
  const snapped = Math.round(degrees / step) * step;
  const wrapped = ((snapped + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/**
 * 인쇄용 도 라벨. ° 문자는 조판기가 빠뜨리므로 TeX 로 만든다.
 * @param degrees 표시할 각. 반올림한 정수
 * @returns `$60^{\\circ}$` 형태의 전체 수식
 */
export function degreeTex(degrees: number): string {
  const rounded = Math.round(degrees);
  const body = Object.is(rounded, -0) ? "0" : String(rounded);
  return `$${body}^{\\circ}$`;
}
