/**
 * 페이지 mm 폴리라인을 켜짐/꺼짐 패턴으로 나눈다.
 * DisplayList 에 dash 필드가 없어 선분으로 미리 자른다.
 * 꼭짓점에서 위상을 리셋하지 않는다. 패턴 숫자는 호출 측 인쇄 규칙이다.
 */
const EPS = 1e-9;

/**
 * @param points 이미 같은 단위인 경로. 두 점 미만이면 빈 배열
 * @param on 켜짐 길이. 0 이하면 빈 배열
 * @param off 꺼짐 길이. 0 이하면 원본 한 줄을 돌려준다
 * @returns 켜짐 구간마다 2점 이상. 입력을 바꾸지 않는다
 */
export function splitDash(
  points: readonly [number, number][],
  on: number,
  off: number,
): [number, number][][] {
  if (points.length < 2 || !(on > 0)) return [];
  if (!(off > 0)) return [points.map((point) => [point[0], point[1]])];
  const pattern = [on, off];
  const output: [number, number][][] = [];
  let phase = 0;
  let left = pattern[0]!;
  let run: [number, number][] | undefined;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let offset = 0;
    while (offset < length - EPS) {
      const take = Math.min(left, length - offset);
      const at = (distance: number): [number, number] => [
        a[0] + (b[0] - a[0]) * distance / length,
        a[1] + (b[1] - a[1]) * distance / length,
      ];
      if (phase === 0) {
        if (!run) {
          run = [at(offset)];
          output.push(run);
        }
        run.push(at(offset + take));
      }
      offset += take;
      left -= take;
      if (left < EPS) {
        phase = 1 - phase;
        left = pattern[phase]!;
        run = undefined;
      }
    }
  }
  return output;
}
