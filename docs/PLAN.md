# PLAN — alid STEM 확장

stemdraw(STEMFIG)의 `math.geometry`·`physics.mechanics` 플러그인을 alid 캔버스 객체로 옮깁니다. 목표는 캔버스 위에서 **객체 내부 손잡이를 끌어 작도·그래프·역학 도식을 편집**하는 것입니다. alid 커널은 수정하지 않습니다. GitHub 저장소 설치(API 2)로 공개된 계약만 사용합니다.

이 문서는 결정과 진행 상황의 기록입니다. 각 단계의 완료 기준은 목표입니다. 실제 검증 결과는 [진행 기록](#진행-기록)에 따로 적습니다.

## 1. 전제

### stemdraw 쪽 (원본 `~/Workspace/stemdraw`)

- 두 플러그인은 DOM·Grida 의존이 없는 순수 TypeScript입니다. 소켓은 `StemfigPlugin`입니다. 문서 해석(`init`)·그리기(`compile`)·끌기(`hit`/`apply`/`toSpec`)·손잡이 표시(`anchors`)·작도 도구(`place`/`preview`/`guidance`/`finish`/`cancel`)·속성(`fields`/`applyField`/`validateField`)·스냅(`snap`)·삭제(`remove`)가 분리되어 있습니다.
- 출력은 페이지 mm 단위 DisplayList입니다. `@stemfig/display`의 `renderSvg`가 이를 SVG로 바꾸며, 수식 라벨은 MathJax로 경로를 구워 넣습니다.
- 외부 런타임 의존은 `zod`와 `mathjax-full`뿐입니다.

### alid 쪽 (원본 `~/Workspace/alid`)

- 저장소 설치 확장은 `trusted-tier1`로 실행됩니다. `renderDom`·`renderSvg`·`selection` 기여를 그대로 쓸 수 있습니다.
- 내부 손잡이 편집에 필요한 기능은 모두 공개 경로로 얻습니다. `@alid/extension-vector-path`가 이 조합으로 정점 편집을 구현합니다.

  | 필요한 것 | 얻는 곳 |
  | --- | --- |
  | 상태 머신, 손잡이 등록표, 실행 취소 그룹, HUD | `canvas.active-tool-surface`: `selection.stateMachine`, `selection.gizmos`, `host.history`, `surface.hud` |
  | 끄는 동안의 미리보기 | `world.createScratchOverlay(owner)` |
  | 단일 프레임 갱신 | `canvas.frames` |
  | 생성 | `canvas.creation` |
  | 도구 키 전달 | `canvas.tool-input` |

- 제약은 다음과 같습니다.
  - 설치기는 저장소 **루트의 `alid.extension.json` 하나**만 읽습니다. 저장소 1개가 설치 단위 1개입니다.
  - 번들은 **2 MiB 이하의 단일 ESM**이어야 합니다(`MAX_SOURCE_BYTES`).
  - 공유 TeX 서비스가 없습니다.
  - 객체 일부를 선택하는 커널 API(`pickTarget`)가 없어, 하위 선택은 로컬 상태로 둡니다.
  - 커널은 Computed를 증분 없이 전체 재계산합니다.

## 2. 결정

| # | 결정 | 이유 |
| --- | --- | --- |
| D1 | 설치 단위 하나: `jiwonme.stem` | 설치기가 저장소당 manifest 하나만 읽고, MathJax를 한 번만 번들하기 위함 |
| D2 | 어스펙트 두 개: `jiwonme.stem.geometry`, `jiwonme.stem.mechanics` | 그래프는 기하 어스펙트를 축·격자 시작값으로 만든 것. 그래프 위 작도가 자연스럽다 |
| D3 | stemdraw 소스는 `vendor/stemfig/`에 **사본**으로 두고 원본 커밋 SHA를 기록한다. 사본은 직접 고치지 않는다 | stemdraw는 npm 미배포 사설 모노레포. 사본 테스트로 동작 동일성을 계속 확인 |
| D4 | 공개 저장소 `jiwonMe/alid-stem-extensions` | 설치기는 공개 저장소만 읽는다 |
| D5 | 단위: 1 mm = 96/25.4 alid 월드 px | alid SDK 결정(`docs/sdk/CONTRACTS.md`)과 같은 값 |
| D6 | 수식은 오프라인 MathJax만. upmath(네트워크)는 쓰지 않는다 | 읽기 시 네트워크·비결정성 제거, 헤드리스 출판 일치 |
| D7 | MathJax SVG 글리프 경로표는 빌드 때 deflate로 묶고 로드 때 한 번 푼다 | 2 MiB 한도(아래 P0 측정) |

## 3. 정본 모델

alid 엔티티 하나가 stemfig figure 하나에 해당합니다.

```ts
// 정본 어스펙트 jiwonme.stem.geometry / jiwonme.stem.mechanics
{
  schema: 1,
  view: { xmin, xmax, ymin, ymax, stretch? },  // stemfig figure.view
  grid?: Grid, axes?: Axes,                     // stemfig 봉투 크롬
  color?: string,                               // 잉크
  handles?: string[],                           // stemfig interaction.handles
  spec: GeometrySpec | MechanicsSpec            // stemfig spec과 같은 모양 (draft 제외)
}
```

- 위치·크기는 alid의 `core.transform`/`core.bounds`가 맡습니다. stemfig `frame`은 여기서 파생합니다(px → mm).
- **`spec.draft`는 정본에 쓰지 않습니다.** 작도 중간 상태는 로컬 도구 상태와 ScratchOverlay에만 둡니다(Gate 1).
- `spec`은 stemfig/v1 JSON과 서로 옮길 수 있습니다. 가져오기·내보내기 명령으로 연결합니다.
- 리사이즈는 `view`를 바꾸지 않습니다. stemfig `fitView`의 contain 규칙으로 맞춥니다.
- 파괴적 스키마 변경은 `jiwonme.stem.geometry@2`처럼 새 어스펙트로 분리합니다.

## 4. 어댑터 구조

```text
src/
  index.ts            ExtensionPackageSpec 조립
  manifest.js         번들·빌드 공통 계약 (aspect·command ID)
  engine.ts           stemfig 레지스트리, figure 실행·SVG 직렬화 (P0)
  units.ts            mm ↔ 월드 px, 엔티티 로컬 ↔ figure 좌표
  figure-aspect.ts    범용 figure kind → 어스펙트 (derive/renderSvg/속성) (P1)
  content.ts          정본 props ↔ stemfig figure 내용 (P1)
  stemfig-import.ts   stemfig/v1 붙여넣기 (P1)
  alid.ts             사용하는 alid 공개 계약의 구조 타입 (P1)
  edit/               편집 HSM, 손잡이, ScratchOverlay, 단일 Undo (P2)
  tools/              place/preview/guidance, HUD 툴바·키 (P3)
  inspector-panel.ts  fields/applyField 동적 속성 패널 (P3)
  kinds.ts            플러그인 등록과 생성 프리셋
vendor/stemfig/       stemdraw 사본 (UPSTREAM.md)
scripts/              build, dev, sync-stemfig, mathjax-glyph-pack
```

어댑터는 플러그인 이름을 모릅니다. 새 stemfig 플러그인은 `kinds/` 파일 하나로 붙입니다.

### 렌더링

- `derive(props, id, view)`는 다음을 순서대로 실행합니다.
  1. `core.transform`·`core.bounds`를 읽는다.
  2. `specSchema` → `init` → `compileChrome` + `compile`을 실행한다.
  3. `{ geometry, items, state, error }`를 반환한다. 이 결과는 정본에 쓰지 않는다.
- 같은 (props, bounds)이면 이전 결과를 재사용합니다. 커널이 전체 재계산하기 때문입니다.
- `renderSvg`와 `renderDom`은 같은 SVG 본문 문자열을 씁니다(Gate 5).
- 오류가 있는 figure는 stemfig와 같이 오류 상자로 그립니다. 정본은 보존합니다.

### 선택과 편집

- 객체 선택은 figure 박스입니다. 박스가 stemfig의 clip 프레임이고, stemdraw도 figure 선택에 `frame`을 씁니다. P1은 alid 기본 박스 선택을 그대로 씁니다.
- P2의 선택 기여는 편집 중 `canTransform`을 false로 돌려 기본 변형 손잡이를 끕니다.
- 편집 모드 진입은 객체 선택 후 더블클릭 또는 Enter입니다. 진입하면:
  - `root.select.jiwonme.stem:edit` 하위 상태를 올린다.
  - `anchors()`로 손잡이를 등록한다. 우선순위는 20 이상(코어 리사이즈 10보다 높게)이다.
  - 손잡이는 HUD에 그린다.
- 드래그 한 프레임의 처리:
  1. 포인터(월드 px)를 페이지 mm로 바꿔 `HandlePatch`를 만든다.
  2. `apply`와 `toSpec`을 실행한다.
  3. ScratchOverlay에 `{ spec }`을 쓴다.
- 확정은 `scratch.clear()` → `history.begin()` → `applyCanonicalTransaction` 1회 → `history.commit()` 순서입니다. Escape는 scratch만 지웁니다.
- 수정키는 Shift를 `constrain`, Alt를 `unsnap`으로 전달합니다. `onModifiersChanged`로 마우스 정지 중 토글도 반영합니다. IME 가드는 호스트 중재를 따릅니다.

## 5. 단계

| 단계 | 내용 | 완료 기준 |
| --- | --- | --- |
| **P0 기반** | 템플릿으로 저장소 생성, TS 빌드, minify, stemfig 사본·동기화 스크립트, 사본 테스트 실행, 번들 크기 측정과 대응 | 사본 테스트 통과, 타입 검사 통과, 실제 엔진 포함 번들 ≤ 2 MiB, 글리프 압축 전후 조판 결과 동일 |
| **P1 정적 그림** | 두 어스펙트, 생성 버튼 3개(기하·그래프·역학), derive/renderSvg/renderDom, 선택 기하, view·격자·축 속성, stemfig JSON 가져오기 | fixture 9장의 SVG가 stemfig `renderSvg`와 일치, 열람 시 정본 커밋 0, 화면 밖 SVG 출판 |
| **P2 드래그 편집** | 편집 HSM, 손잡이, ScratchOverlay, 단일 Undo, 스냅, Shift/Alt, Escape | 드래그 → Undo 1회로 원복, 취소 시 정본 불변 |
| **P3 작도 도구** | place/preview/guidance/finish, HUD 툴바·단축키·미니버퍼, 동적 속성 패널, 삭제 | 클릭으로 삼각형→중선→교점, 다단 클릭 작도가 Undo 1회 |
| **P4 역학 마감** | 경로 부착, 끝점 연결·해제(Alt), 실·도르래, 포물선, 받침대 | stemdraw 역학 fixture 3종 재현 |
| **P5 문서화** | README, 5대 게이트 검증 기록, stemfig 내보내기 | 검증한 사실과 미검증을 구분해 기록 |

## 6. 위험

1. **번들 크기**: P0 측정은 [진행 기록](#진행-기록)을 참고하세요. 여유가 부족해지면 다음 순서로 대응합니다.
   1. 사용 빈도가 낮은 MathJax 변형 글꼴(fraktur·oldstyle·monospace·sans-serif 계열)을 뺀다. 측정치 약 160K 절감.
   2. alid에 공유 `math.tex` 서비스를 제안한다. 호스트 변경이라 별도 합의가 필요하다.
2. **동시 편집**: `spec` 전체가 한 필드라서 같은 figure를 동시에 고치면 나중 쓰기가 이깁니다. 필요해지면 `objects`를 id 키 맵으로 바꾼 `@2` 어스펙트를 추가합니다.
3. **하위 선택 API 부재**: 하위 선택은 로컬 상태로 둡니다. 커널에 `pickTarget`이 생기면 옮깁니다.
4. **성능**: 캐시로 줄이되, 120fps·0-GC는 측정 전까지 주장하지 않습니다.
5. **사본 드리프트**: `scripts/sync-stemfig.mjs`와 `vendor/stemfig/UPSTREAM.md`의 SHA로 관리합니다. 동기화 뒤 사본 테스트를 다시 돌립니다.

## 진행 기록

### P0 — 기반 (2026-11-05)

- 저장소: `jiwonMe/alid-stem-extensions`. `jiwonMe/alid-extension-template` 0.3.0(dev 서버 포함)에서 생성.
- 사본: stemdraw `d2ffccd`의 `display`·`host`·`plugin-kit`·`plugin-math-geometry`·`plugin-physics-mechanics`. 사본 테스트는 vitest로 실행.
- 번들 크기 측정. 두 플러그인 + `renderSvg` + `compileChrome` + MathJax(base+ams)를 단일 ESM으로 묶었다.

  | 구성 | 바이트 | 2 MiB 대비 |
  | --- | --- | --- |
  | 압축 없음 | 2,603,438 (2.48 MiB) | 초과 |
  | minify | 2,187,433 (2.09 MiB) | 88K 초과 |
  | minify + 드문 변형 글꼴 9종 제거 | 2,021,814 (1.93 MiB) | 74K 여유 |
  | **minify + 글리프 경로 deflate(D7) — 채택** | **1,513,550 (1.44 MiB)** | **약 570K 여유** |

- 크기 구성: MathJax SVG 글꼴 경로 약 990K, MathJax 나머지 약 800K, geometry 184K, mechanics 127K, zod 97K, display 36K.
- 대응 D7(`scripts/mathjax-glyph-pack.mjs`):
  - 글꼴 경로표 21개를 빌드 시작 때 한 번에 추출한다. 원문 969K가 deflate 405K, base64 541K가 된다.
  - 각 글꼴 모듈은 공유 압축본에서 경로를 꺼내 `AddPaths`를 호출한다. 압축본은 처음 쓸 때 한 번 동기 inflate한다.
  - 압축 라이브러리는 fflate(순수 JS, 고정 레벨)로, 빌드가 결정적이다. 두 번 빌드한 SHA-256이 같았다.
  - 빌드는 2 MiB 초과 시 실패한다.
- 결과: `pnpm typecheck` 통과. `pnpm test` 통과.
  - 사본 테스트 97 파일 626개와 어댑터 테스트(vitest 648개 합계) 통과.
  - 번들 테스트(node --test) 10개 통과.
- **엔진 동일성**: stemdraw 원본 파이프라인(압축 없는 MathJax)이 그린 fixture 9장 18개 figure를 `test/golden/fixtures.json`에 기록했다. **빌드한 번들**이 같은 figure를 바이트 단위로 똑같이 그린다. 글리프 압축·minify가 결과를 바꾸지 않는다는 근거다.
- 미검증: 실제 브라우저 alid에서의 설치·실행, 첫 inflate 비용, 120fps·0-GC.

### P1 — 정적 그림 (2026-11-05)

- 어스펙트 `jiwonme.stem.geometry`·`jiwonme.stem.mechanics` (`src/figure-aspect.ts`).
  - 정본: `{ schema, view, grid, axes, color, handles, spec }`. 커널의 기본값 타입 검사에 맞추기 위해 없는 값은 `null`/`""`로 둔다. `spec.draft`는 생성·가져오기 때 제거한다.
  - `derive`는 박스(px)를 mm로 바꿔 stemfig 파이프라인을 그대로 실행한다. 결과(DisplayList·SVG 본문)는 파생에만 둔다. 같은 props 객체와 크기면 컴파일을 재사용한다.
  - `renderSvg`는 `translate · rotate · scale(STEMFIG_TO_WORLD)` 아래에 stemfig SVG 본문을 넣는다. 화면과 출판이 같은 문자열이다.
  - 엔진·spec 오류는 stemfig 오류 상자, view 같은 봉투 오류는 일반 오류 상자로 그린다. 정본은 보존한다.
- 결정 변경: P1은 선택 기여를 등록하지 않는다. figure 박스가 곧 stemfig의 clip 프레임이고 stemdraw도 figure 선택에 `frame`을 쓰므로, alid 기본 박스 선택·이동·리사이즈·회전이 그대로 맞다. 내부 손잡이 편집을 위한 선택 기여는 P2에서 추가한다.
- 생성 도구 3개(`add-geometry`·`add-graph`·`add-mechanics`): 도구 선반 action과 명령. `canvas.creation`으로 한 배치·한 Undo로 만든다. 빈 프레임 대신 편집 가능한 작은 예제로 시작한다.
- 속성: 격자·축 켜기/끄기(세그먼트). view·색·spec 세부 편집은 P3의 동적 속성 패널에서 다룬다.
- stemfig/v1 가져오기: `core.clipboard`(선택 의존성)의 붙여넣기 처리기. 지원하는 kind의 figure마다 엔티티 하나, 상대 배치 유지, 삽입 지점 중심. 일반 텍스트는 다른 처리기에 넘긴다.
- 단위: `worldToMm`을 1e-9 mm로 반올림해 stemfig 프레임이 mm → px → mm 왕복에서 정확히 보존된다(없으면 70 mm가 69.999…가 되어 결과가 달라졌다).
- 검증:
  - `pnpm typecheck` 통과.
  - vitest 685개 통과. 사본 626개, 어댑터·가져오기 단위 테스트, 그리고 alid 통합 테스트 7개를 포함한다.
  - **alid 통합 테스트** (`src/alid-host.test.ts`): 로컬 alid 체크아웃(`$ALID` 또는 `~/Workspace/alid`)의 실제 커널·설치기 검증·클립보드 확장 위에서 **빌드한 번들**을 실행한다. 다음을 확인한다.
    - 설치기의 매니페스트·해시·계약 검사 통과
    - 설치·활성화 시 정본 커밋 0
    - 프리셋 생성이 각각 Undo 그룹 1개이고 내용 어스펙트만 기록
    - `compileToPureSvg` 출판 결과에 렌더·파생 오류가 없고, 열람·출판 시 커밋 0
    - 정본 스냅샷에 파생 데이터 없음
    - stemfig 붙여넣기가 Undo 그룹 1개
    - 확장을 꺼도 정본이 보존되고 읽기 전용으로 표시됨
    - 체크아웃이 없는 CI에서는 이 묶음을 건너뛴다.
  - 번들 테스트(node --test) 11개 통과. fixture 18개 figure의 바이트 동일성을 유지한다.
- 번들: 1,520,590 B (1.45 MiB).
- 미검증: 브라우저 playground에서의 설치·화면 표시(데스크톱 브라우저 미연결), DOM 아일랜드 없이 벡터만 쓰는 객체의 GPU 대역 표시, 한글 라벨의 화면·출판 글꼴 차이, 120fps·0-GC.
- 메모: 한글 라벨(`A 구간` 등)은 stemdraw에서도 평문 `<text>`라 시스템 글꼴을 쓴다. 화면과 출판의 글꼴 차이는 P1에서 다시 본다.
