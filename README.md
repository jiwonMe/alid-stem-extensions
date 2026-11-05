# alid STEM 확장

[alid](https://github.com/jiwonMe/alid) 캔버스에 **끌어서 편집하는 기하 작도·함수 그래프·역학 도식**을 추가하는 확장입니다. 그림 엔진은 [stemdraw(STEMFIG)](https://github.com/jiwonMe/stemdraw)의 `math.geometry`·`physics.mechanics` 플러그인을 그대로 쓰므로, 같은 그림은 stemdraw와 바이트 단위로 같게 그려집니다. [jiwonMe/alid-extension-template](https://github.com/jiwonMe/alid-extension-template)에서 만들었습니다.

설계와 단계별 기록은 [docs/PLAN.md](docs/PLAN.md), 완료 게이트 검증은 [docs/GATES.md](docs/GATES.md)에 있습니다.

## 설치

alid **확장 관리 → GitHub에서 설치**에 `jiwonme/alid-stem-extensions`를 입력하고, 버전과 커밋을 확인한 뒤 신뢰를 승인합니다.

- 설치 API 2를 지원하는 alid가 필요합니다.
- 도구 아이콘을 보려면 확장 아이콘(path 데이터)을 지원하는 alid가 필요합니다. 지원하지 않으면 기본 아이콘으로 보입니다.
- 설치만으로는 문서가 바뀌지 않습니다.

이 확장은 앱 안에서 실행되는 신뢰 확장입니다. 사용하는 호스트 서비스는 다음과 같습니다.

| 서비스 | 용도 |
| --- | --- |
| `canvas.creation` | 그림 생성 |
| `canvas.active-tool-surface`, `canvas.frames`, `canvas.tool-input` | 안쪽 편집 |
| `canvas.clipboard` (`core.clipboard`, 선택 의존성) | stemfig JSON 붙여넣기 |

## 사용

### 그림 추가

| 도구 선반 | 시작하는 그림 |
| --- | --- |
| **기하 작도 추가** | 삼각형 ABC |
| **함수 그래프 추가** | 축·격자 위의 y = x²/2 − 1 |
| **역학 도식 추가** | 빗금 친 지면 위 상자와 힘 F |

명령 팔레트(`Mod-k`)에서도 같은 이름으로 실행합니다. 생성은 실행 취소 한 번입니다.

그림은 일반 객체처럼 선택·이동·리사이즈·회전합니다. 크기를 바꾸면 좌표 범위는 그대로 두고 비율을 유지해 맞춥니다. 속성 패널에서 격자와 축을 켜고 끕니다.

stemdraw의 `stemfig/v1` JSON을 복사해 캔버스에 붙여넣으면, 지원하는 그림이 배치를 유지한 채 각각 객체로 들어옵니다. 다른 종류의 figure는 건너뜁니다. `core.clipboard` 확장이 켜져 있어야 합니다.

### 그림 안쪽 편집

그림을 선택하고 더블클릭하거나 Enter, 또는 선택 도구 모음의 **그림 안쪽 편집**을 누릅니다.

| 동작 | 방법 |
| --- | --- |
| 끌기 | 점·경로 점·라벨·물체를 끌면 의존하는 작도가 따라옵니다. 손을 떼면 실행 취소 1단위로 기록됩니다 |
| 스냅 | 다른 점·선·교점·물체 연결점에 붙고, 붙을 곳이 표시됩니다. Alt를 누르면 붙지 않고, 붙어 있던 끝은 떨어집니다 |
| 제약 | Shift는 각도·축을 제약합니다 |
| 작도 | 위쪽 도구 모음이나 글자 키(P 점, L 선분, C 원, G 그래프…)로 도구를 고르고 안내대로 클릭합니다. 완성될 때 한 번 기록됩니다. 경로·지면은 Enter나 **완료**로 끝냅니다. V는 끌기로 돌아갑니다 |
| 속성 | 손잡이를 고르면 오른쪽 속성 패널에 좌표·라벨·색·선 모양 등이 나타납니다. 잘못된 값은 이유를 보여 주고 적용하지 않습니다 |
| 삭제 | 손잡이를 고르고 Delete를 누르면 그것에 의존하는 작도까지 함께 지웁니다 |
| 취소·끝내기 | Esc는 끄는 중인 드래그 → 미완성 작도 → 도구 → 편집 순으로 하나씩 취소합니다. 그림 밖을 클릭해도 편집이 끝납니다 |

**역학**: 힘·용수철·실·치수의 끝을 물체나 경로 꼭짓점 위로 끌면 붙고, 붙은 끝은 물체를 따라 움직입니다. 경로에 붙은 물체를 끌면 경로를 따라 미끄러집니다. 실 도구로 도르래 테두리를 거치면 도르래를 감는 실이 됩니다.

확장을 끄거나 제거해도 그림 데이터는 문서에 남고 읽기 전용으로 표시됩니다.

## 개발

Node.js 22.12 이상과 pnpm 11.22.0이 필요합니다.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test          # 빌드 → vitest(stemfig 사본·어댑터·alid 통합·게이트) → 번들 테스트(node --test)
pnpm test:gates    # 완료 게이트만 (로컬 alid 체크아웃과 Wasm 빌드 필요)
pnpm dev           # watch 빌드 + alid "개발 중인 확장 연결" 서버 (127.0.0.1:5174)
```

- `dist/plugin.js`와 `alid.extension.json`은 설치기가 읽으므로 커밋합니다. CI는 다시 빌드한 결과가 커밋본과 같은지 확인합니다.
- alid 통합·편집기·게이트 테스트는 로컬 alid 체크아웃(`$ALID` 또는 `~/Workspace/alid`)을 사용합니다. 게이트는 그 체크아웃의 Wasm 빌드(`pnpm build:wasm`)도 필요합니다. 없으면 해당 묶음을 건너뛰며, GitHub CI도 건너뜁니다.
- 번들 크기는 약 1.5 MiB입니다(설치 한도 2 MiB, 초과 시 빌드 실패).

### 구성

| 경로 | 역할 |
| --- | --- |
| `src/engine.ts` | stemfig 파이프라인(문서 → DisplayList → SVG, 편집 함수) 래퍼. figure 종류를 모름 |
| `src/figure-aspect.ts`, `content.ts` | 그림 → alid 어스펙트(정본·파생·SVG·선택) |
| `src/edit/` | 안쪽 편집기(HSM·손잡이·미리보기·단일 Undo), 작도 도구 모음, 속성 패널 |
| `src/kinds.ts` | 플러그인 등록과 생성 프리셋 |
| `src/stemfig-import.ts` | stemfig/v1 붙여넣기 |
| `src/icons.ts`, `src/stemfig-icons.ts` | 도구 아이콘. 후자는 `scripts/convert-stemfig-icons.mjs`가 stemdraw UI 아이콘에서 생성 |
| `vendor/stemfig/` | stemdraw 패키지 사본. 직접 고치지 않음. 원본 커밋은 [UPSTREAM.md](vendor/stemfig/UPSTREAM.md) |
| `scripts/mathjax-glyph-pack.mjs` | MathJax 글리프 경로표를 deflate로 묶어 번들을 2 MiB 안에 둠 |
| `test/golden/fixtures.json` | stemdraw 원본 파이프라인이 그린 fixture SVG. 빌드 번들과 바이트 단위 비교 |

### stemdraw 갱신 가져오기

```sh
pnpm sync:stemfig        # 기본 ~/Workspace/stemdraw, 또는 경로 인자 / $STEMDRAW
pnpm golden
node scripts/convert-stemfig-icons.mjs   # 아이콘이 바뀐 경우 (ICONS=… 로 범위 지정 가능)
pnpm test
```

원본 작업 트리에 커밋하지 않은 변경이 있으면 거부합니다. 사본과 골든 파일의 diff를 함께 검토하세요.

## 검증 범위

| 항목 | 상태 |
| --- | --- |
| 엔진 동일성 | 빌드 번들로 stemdraw fixture 18개 figure를 그려 원본과 바이트 단위 일치 |
| 정본 순수성 | 통과 ([GATES.md](docs/GATES.md)) |
| 단일 Undo | 통과 |
| 참조 보존 | 통과 |
| 벡터 출판 | 통과 |
| 한글 IME | 키 보호는 자동 검증. OS 실기 입력은 미검증 |
| 120fps·0-GC | 주장하지 않음. 측정값만 기록 |

playground에서도 각 단계를 수동으로 확인했지만, 실제 마우스가 아니라 합성 포인터 이벤트로 조작했습니다.

## 라이선스

MIT License. `vendor/stemfig/`와 `src/stemfig-icons.ts`는 stemdraw의 라이선스를 따릅니다. stemdraw의 아이콘에는 Nucleo UI 아이콘이 포함되어 있습니다.
