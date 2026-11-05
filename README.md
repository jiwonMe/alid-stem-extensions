# alid STEM 확장

[alid](https://github.com/jiwonMe/alid) 캔버스에 **끌어서 편집하는 기하 작도·함수 그래프·역학 도식**을 추가하는 확장입니다. [stemdraw(STEMFIG)](https://github.com/jiwonMe/stemdraw)의 `math.geometry`·`physics.mechanics` 엔진을 그대로 사용합니다. [jiwonMe/alid-extension-template](https://github.com/jiwonMe/alid-extension-template)에서 만들었습니다.

> **진행 상태: P2(드래그 편집)** — 캔버스에 기하 작도·함수 그래프·역학 도식을 추가하고, 그림 안쪽의 점·경로·물체·라벨을 끌어 편집하고, SVG로 내보낼 수 있습니다. 새 작도를 클릭으로 추가하는 도구(P3)는 아직 없습니다. 단계와 결정은 [docs/PLAN.md](docs/PLAN.md)를 보세요.

## 설치

alid **확장 관리 → GitHub에서 설치**에 `jiwonme/alid-stem-extensions`를 입력합니다. 설치 API 2를 지원하는 alid가 필요합니다. 설치만으로는 문서가 바뀌지 않습니다.

## 사용

- 도구 선반의 **기하 작도 추가**·**함수 그래프 추가**·**역학 도식 추가**가 현재 화면 가운데에 그림을 만듭니다. 명령 팔레트(`Mod-k`)에서도 같은 이름으로 실행합니다. 생성은 실행 취소 한 번으로 되돌립니다.
- 그림은 일반 객체처럼 선택·이동·리사이즈·회전합니다. 크기를 바꾸면 좌표 범위(view)는 그대로 두고 비율을 유지해 맞춥니다.
- 속성 패널에서 격자와 축을 켜고 끕니다.
- **그림 안쪽 편집**: 그림을 선택한 뒤 더블클릭하거나 Enter, 또는 선택 도구 모음의 **그림 안쪽 편집**을 누릅니다. 점·경로 점·라벨·물체를 끌면 의존하는 작도가 함께 따라오고, 손을 떼면 실행 취소 한 번으로 되돌릴 수 있습니다. 다른 점·선·교점에 자석처럼 붙고 Alt로 끕니다. Shift는 각도·축 제약입니다. Esc는 끄는 중이면 취소, 아니면 편집을 끝냅니다.
- 도구 아이콘은 확장이 제공하는 그림입니다. 확장 아이콘을 지원하는 alid가 필요하며, 지원하지 않는 호스트에서는 기본 아이콘으로 보입니다.
- stemdraw의 `stemfig/v1` JSON을 복사해 캔버스에 붙여넣으면 지원하는 그림(`math.geometry`, `physics.mechanics`)이 각각 객체로 들어옵니다. 다른 kind는 건너뜁니다. 기본 `core.clipboard` 확장이 켜져 있어야 합니다.
- 확장을 끄거나 제거해도 그림 데이터는 문서에 남고 읽기 전용으로 표시됩니다.

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
| `src/` | alid 어댑터. `engine.ts`가 stemfig 파이프라인을 감싸고, `figure-aspect.ts`가 캔버스 객체로, `kinds.ts`가 플러그인·생성 프리셋을 등록 |
| `alid-checkout.js` | 통합 테스트용 로컬 alid 경로 |
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
- **alid 통합**: 로컬 alid 체크아웃(`$ALID` 또는 `~/Workspace/alid`)이 있으면 실제 커널과 설치기 검증 위에서 빌드한 번들을 설치·생성·출판·붙여넣기·비활성화합니다. 체크아웃이 없으면 이 묶음은 건너뜁니다.
- **미검증**: 브라우저 playground 화면에서의 수동 확인, 120fps·0-GC는 아직 하지 않았습니다.

MIT License. `vendor/stemfig/`는 stemdraw의 라이선스를 따릅니다.
