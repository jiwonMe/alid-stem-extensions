/**
 * 글자 손잡이 id. 점 A 또는 호 마크 k.
 * 본문과 같은 id 면 apply 가 점·호를 민다.
 * 호스트는 suffix 를 모른다. hit / apply / fields 만 해석한다.
 */

/** 점 id 뒤에 붙인다. 점 id 자체에 이 끝이 오면 안 된다. */
export const LABEL_HANDLE_SUFFIX = ":label";

/**
 * 점 A 또는 호 마크 k 의 글자 손잡이.
 * @param ownerId objects[].id 또는 marks[].id
 * @returns 예: A:label, k:label
 */
export function labelHandleId(ownerId: string): string {
  return `${ownerId}${LABEL_HANDLE_SUFFIX}`;
}

/**
 * 글자 손잡이면 본문 id.
 * apply 가 점·호를 찾지 못하게 여기서만 벗긴다.
 * @param handleId hit / fields focus
 * @returns 점·마크 id. suffix 가 아니면 undefined
 */
export function parseLabelHandle(handleId: string): string | undefined {
  if (!handleId.endsWith(LABEL_HANDLE_SUFFIX)) {
    return undefined;
  }
  const id = handleId.slice(0, -LABEL_HANDLE_SUFFIX.length);
  return id === "" ? undefined : id;
}
