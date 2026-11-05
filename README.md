# alid STEM 확장

[alid](https://github.com/jiwonMe/alid) 캔버스에 **끌어서 편집하는 기하 작도·함수 그래프·역학 도식**을 추가하는 확장입니다. [stemdraw(STEMFIG)](https://github.com/jiwonMe/stemdraw)의 `math.geometry`·`physics.mechanics` 엔진을 그대로 사용합니다. [jiwonMe/alid-extension-template](https://github.com/jiwonMe/alid-extension-template)에서 만들었습니다.

> **진행 상태: P0(기반)** — 엔진·빌드·검증 경로만 있습니다. 캔버스 객체와 편집 도구는 아직 없습니다. 단계와 결정은 [docs/PLAN.md](docs/PLAN.md)를 보세요.

## 설치

alid **확장 관리 → GitHub에서 설치**에 `jiwonme/alid-stem-extensions`를 입력합니다. 설치 API 2를 지원하는 alid가 필요합니다. P0 설치본은 문서 객체를 만들지 않으며 공개 API(`renderFigureSvg`)만 제공합니다.

## 개발

Node.js 22.12 이상과 pnpm 11.22.0이 필요합니다.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test          # 빌드 → stemfig 사본 테스트(vitest) → 번들 테스트(node --test)
pnpm dev           # watch 빌드 + alid "개발 중인 확장 연결" 서버 (127.0.0.1:5174)
```

`dist/plugin.js`와 `alid.extension.json`은 빌드 결과지만 설치기가 읽으므로 커밋합니다. CI는 다시 빌드한 결과가 커밋본과 같은지 확인합니다.

## 구성

| 경로 | 역할 |
| --- | --- |
| `src/` | alid 어댑터. `engine.ts`가 stemfig 파이프라인을 감싸고, `kinds.ts`가 플러그인을 등록 |
| `vendor/stemfig/` | stemdraw 패키지 사본. 직접 고치지 않음. 원본 커밋은 [UPSTREAM.md](vendor/stemfig/UPSTREAM.md) |
| `scripts/mathjax-glyph-pack.mjs` | MathJax 글리프 경로표를 deflate로 묶어 번들을 2 MiB 한도 안에 둠 |
| `scripts/sync-stemfig.mjs` | stemdraw에서 사본을 다시 가져옴 (`pnpm sync:stemfig`) |
| `test/golden/fixtures.json` | stemdraw 원본 파이프라인이 그린 fixture SVG. 빌드 번들과 바이트 단위 비교 (`pnpm golden`으로 재생성) |
| `docs/PLAN.md` | 설계·단계·진행 기록 |

### stemdraw 갱신 가져오기

```sh
pnpm sync:stemfig        # 기본 ~/Workspace/stemdraw, 또는 경로 인자 / $STEMDRAW
pnpm golden
pnpm test
```

원본의 작업 트리에 커밋하지 않은 변경이 있으면 거부합니다. 사본과 골든 파일의 diff를 함께 검토하세요.

## 검증 범위

- **엔진 동일성**: `pnpm test`는 빌드한 번들로 stemdraw fixture 18개 figure를 그리고, stemdraw 원본 파이프라인 결과와 바이트 단위로 같은지 확인합니다. 글리프 압축과 minify가 결과를 바꾸지 않는다는 근거입니다.
- **설치 계약**: 매니페스트 해시, 번들 크기 2 MiB 이하, 외부 import 없음, 설치·활성화 시 문서 쓰기 없음을 확인합니다.
- **미검증**: 브라우저 안의 alid에서 실제로 설치하는 것은 아직 확인하지 않았습니다. 120fps·0-GC는 측정하지 않았습니다.

MIT License. `vendor/stemfig/`는 stemdraw의 라이선스를 따릅니다.
