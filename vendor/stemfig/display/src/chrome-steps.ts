/**
 * 격자·눈금 위치. compile 만 쓴다. 문서 스키마가 아니다.
 */

/**
 * [min, max] 안의 step 배수. 부동소수 누적을 피하려고 i*step.
 * @param limit DisplayList 상한. 넘으면 앞쪽만
 * @returns 오름차순. 0 근처는 0
 */
export function steps(
  min: number,
  max: number,
  step: number,
  limit: number,
): number[] {
  if (!(step > 0) || !(max > min) || limit < 1) {
    return [];
  }
  const first = Math.ceil((min - 1e-12) / step);
  const last = Math.floor((max + 1e-12) / step);
  const out: number[] = [];
  for (let i = first; i <= last && out.length < limit; i += 1) {
    const value = i * step;
    out.push(Math.abs(value) < 1e-12 ? 0 : value);
  }
  return out;
}

/**
 * 주 간격 위의 점. 보조선·보조 눈금을 건너뛸 때.
 */
export function onMajor(value: number, major: number): boolean {
  if (!(major > 0)) {
    return false;
  }
  const q = value / major;
  return Math.abs(q - Math.round(q)) < 1e-8;
}

/**
 * 눈금 숫자. 정수면 점 없이.
 */
export function formatTick(value: number): string {
  const nearest = Math.round(value);
  if (Math.abs(value - nearest) < 1e-9) {
    return String(nearest);
  }
  return String(Number(value.toPrecision(6)));
}
