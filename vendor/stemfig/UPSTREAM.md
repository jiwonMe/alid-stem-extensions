# vendor/stemfig

stemdraw(STEMFIG) 패키지의 사본입니다. 직접 고치지 않습니다. 변경은 stemdraw에 먼저 반영한 뒤 `pnpm sync:stemfig`로 다시 가져옵니다.

- 원본: `jiwonMe/stemdraw` (로컬 `~/Workspace/stemdraw`)
- 커밋: `d2ffccdc50054a1dbd178bbf652951c298b20d7d`

| 사본 | 원본 |
| --- | --- |
| `display/` | `packages/display/{src}` |
| `host/` | `packages/host/{src}` |
| `plugin-kit/` | `packages/plugin-kit/{src}` |
| `geometry/` | `packages/plugin-math-geometry/{src,fixtures}` |
| `mechanics/` | `packages/plugin-physics-mechanics/{src,fixtures}` |

import 이름(`@stemfig/*`)은 원본 그대로이며 `stemfig-aliases.js`가 사본으로 연결합니다. 외부 의존은 `zod`·`mathjax-full`이며 버전은 원본과 맞춥니다.
