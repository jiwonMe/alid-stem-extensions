/**
 * view 를 쓰는 kind 가 공유하는 zod 조각.
 * 교과 지식은 없다. 직사각형 하나를 검사할 뿐이다.
 * 여기에 objects / series 같은 교과 필드를 넣지 말 것.
 */
import { z } from "zod";

/**
 * 수학 좌표 창. min < max 를 여기서 막아야 fitView 가 0 나눗셈을 만나지 않는다.
 * 각 플러그인 specSchema 의 view 필드에 그대로 꽂는다.
 */
export const viewSchema = z
  .object({
    xmin: z.number(),
    xmax: z.number(),
    ymin: z.number(),
    ymax: z.number(),
  })
  .refine((view) => view.xmin < view.xmax && view.ymin < view.ymax, {
    message: "view min must be less than max",
  });
