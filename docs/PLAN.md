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
- `spec`은 stemfig/v1과 같은 모양이라 stemfig JSON을 붙여넣어 가져올 수 있습니다. alid 그림을 stemfig JSON으로 내보내는 기능은 만들지 않기로 했습니다(P5 결정).
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
  icons.ts            도구 아이콘 path 데이터 (P2)
  stemfig-icons.ts    stemdraw UI 아이콘 변환본 (P3, scripts/convert-stemfig-icons.mjs)
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
| **P5 문서화** | README, 5대 게이트 검증 기록 | 검증한 사실과 미검증을 구분해 기록 |

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

### P2 — 드래그 편집 (2026-11-05)

- `src/edit/figure-editor.ts`: 플러그인 이름을 모르는 내부 편집기. `canvas.active-tool-surface`를 따라 활성 뷰에 붙는다.
  - 진입: 선택한 그림을 더블클릭, Enter, 선택 도구 모음의 **그림 안쪽 편집**, 명령 `jiwonme.stem:edit-figure`.
  - HSM `root.select.jiwonme.stem:edit` 아래 `idle`·`dragging`. 끝내기는 Esc·Enter·그림 밖 클릭·선택 해제·창 비활성화.
  - 손잡이: stemfig `anchors()`의 점 손잡이를 GizmoRegistry에 우선순위 30으로 등록(리사이즈 10보다 높음). 점이 아닌 손잡이(선분·경로·라벨·물체 몸통)는 stemfig `hit()`로 그림 안 클릭에서 고른다. 표시는 기즈모 평면(HUD)의 SVG.
  - 드래그 처리:
    1. 포인터 이벤트는 위치만 기록한다.
    2. 호스트 프레임(`canvas.frames`)에서 누른 순간의 정본 spec을 기준으로 stemfig `snap`·`apply`를 실행해 ScratchOverlay에 미리보기를 쓴다. stemdraw 에디터의 `handleSnapMove`와 같은 규칙(점 손잡이는 의도 위치 → 스냅 → 절대 포인터 patch).
    3. 놓으면 `history.begin` → 정본 1회(`spec`만) → `commit`.
  - 수정키: Shift→`constrain`, Alt→스냅 해제·연결 해제. `onModifiersChanged`로 정지 중 토글 반영.
  - Esc는 드래그 중이면 미리보기만 버리고 편집을 유지하며, 한 번 더 누르면 편집을 끝낸다. IME 조합 중·직후 16 ms의 키는 무시한다.
  - 원격 변경·Undo가 편집 중인 그림에 닿으면 드래그를 취소하고 새 정본에서 다시 시작한다(나중 쓰기가 원격 변경을 덮지 않음).
  - 회전·이동·크기 변경된 그림에서도 손잡이가 박스를 따른다(world px ⇄ 그림 page mm 변환, `edit/figure-frame.ts`).
- 선택 기여 추가: 박스 선택(정확한 회전 박스 SAT), 편집 중에는 `canTransform` false로 기본 변형 손잡이를 끈다.
- **아이콘**: alid에 확장 아이콘 계약을 추가했다(아래). 이 확장은 도구별 path 아이콘을 쓴다: 기하(꼭짓점 표시 삼각형), 그래프(축과 포물선), 역학(빗금 지면 위 상자와 힘 화살표), 그림 안쪽 편집(점선 틀 안의 점).
- **alid 변경(별도 커밋 필요, 미커밋 상태로 둠)**:
  - `packages/kernel/src/workbench-types.ts`: `WorkbenchIcon = string | { paths: string[]; fill?: boolean }`. action·segmented 선택지·패널 아이콘에 사용.
  - `packages/kernel/src/workbench.ts`: `validateWorkbenchIcon` — path 명령·숫자만 허용(마크업·URL·알 수 없는 필드 거부), 최대 16개·각 2048자. 등록 시 복제·동결.
  - `apps/playground/src/components/Icon.tsx`: `ContributedIcon`이 path 데이터를 currentColor로 그린다. 모르는 이름은 기본 아이콘. DeclarativeControls·WorkbenchMenus·WorkbenchChrome·WorkbenchNavigation이 사용.
  - 테스트: `packages/kernel/src/workbench-icons.test.ts`, `DeclarativeControls.test.tsx`에 1건.
  - 별건: `packages/sdk/src/svg/jsx-dev-runtime.ts`가 타입 전용 `JSX` 네임스페이스를 값으로 재수출해 playground가 브라우저에서 빈 화면이 되던 문제를 `export type`으로 고쳤다.
- 검증:
  - 이 저장소: typecheck 통과, vitest 699개(편집기 12개 — 실제 커널의 CanvasWorld·ToolStateMachine·GizmoRegistry 위에서 진입·미리보기·단일 Undo·스냅/Alt·회전·Esc·IME·클릭만 할 때 무커밋·밖 클릭 종료·원격 변경 재기준·읽기 전용 거부·역학 물체 경로 이동; 통합 9개), 번들 테스트 통과.
  - alid: `tsc --noEmit` 통과, 전체 vitest 933개 통과.
  - **브라우저 playground 수동 확인**(dev 연결): 도구 선반·선택 도구 모음에 새 아이콘 표시, 기하 그림 생성, 그림 안쪽 편집 진입, 점 C 드래그(미리보기 후 확정), Esc로 편집 종료, ⌘Z 한 번으로 원복.
- 번들: 1,538,960 B (1.47 MiB).
- 미검증: 실제 마우스·트랙패드 입력(합성 PointerEvent로 확인), 분할 뷰 전환 중 편집, OS 한글 IME 실기, 120fps·0-GC.

### P3 — 작도 도구 (2026-11-05)

- 편집 중 상단에 **작도 도구 모음**(`src/edit/toolbar.ts`)이 나타난다. 도구 목록·이름·단축키는 stemfig 플러그인의 `tools`를 그대로 쓴다.
  - 기하 17종: 점·선분·직선·원·다각형·내분·교점·수선의 발·평행선·수선·이등분선·외접원·내접원·각 표시·변 표시·그래프·경로.
  - 역학 16종: 지면·경로·상자·공·용수철·도르래·실·받침대·포물선·힘·각도·치수·보조선·점·라벨.
  - 아이콘은 stemdraw UI 아이콘(Nucleo UI outline 18px + stemdraw 교과 기호)을 path 데이터로 변환해 쓴다(`scripts/convert-stemfig-icons.mjs` → `src/stemfig-icons.ts`). 채운 점을 표현하기 위해 alid 아이콘 계약을 확장했다(아래).
  - 편집 중 글자 키로 도구를 고르고(P·L·C·G…), V는 선택·끌기로 돌아간다.
- 배치: stemfig `place`·`preview`·`guidance`·`finish`·`cancel`.
  - 다단 작도의 중간 단계(`spec.draft`)는 편집기 로컬 상태와 ScratchOverlay에만 둔다. 정본에는 쓰지 않는다(쓰려 하면 예외).
  - 완성된 작도만 한 번 기록해 실행 취소 1단위가 된다.
  - 포인터 아래 미리보기(ghost)는 기즈모 평면에만 그린다(`src/edit/hud-items.ts`).
  - 안내 문구와 완료·작도 취소 버튼을 도구 모음 아래에 표시한다. 경로·지면처럼 끝이 정해지지 않은 작도는 Enter나 **완료**로 끝낸다.
  - Esc 순서: 드래그 → 미완성 작도 → 도구 → 편집 종료.
  - 도구가 켜진 동안 그림 밖 클릭은 편집을 끝내지 않는다.
- 속성: 그림마다 inspector 섹션(`inspectorFor`)을 기여한다(`src/edit/inspector.ts`). 편집 중이면 고른 손잡이(또는 그림 전체)에 대해 stemfig `fields`를 숫자·텍스트·색·켜기/끄기·선택지로 그리고, `validateField`로 거절 이유를 표시하며, `applyField`를 한 번의 실행 취소로 기록한다. 텍스트는 change에서만 기록해 IME 조합을 끊지 않는다.
- 삭제: 편집 중 Delete·Backspace는 고른 손잡이와 의존하는 작도를 stemfig `remove`로 함께 지운다. 한 번의 실행 취소.
- alid 변경(커밋함): 아이콘 계약에 `size`(viewBox, 8–64)와 path별 `{ d, fill }`를 추가하고 최대 path 수를 24로 늘렸다. playground가 이를 그린다.
- 검증:
  - 이 저장소: typecheck 통과, vitest 710개(편집기 19개, 도구 모음·속성 4개 포함), 번들 테스트 통과.
  - 편집기 테스트에서 확인한 것: 두 클릭 선분 배치(중간 단계는 정본 무기록, 완성 시 1회), 기존 점 재사용, Esc 단계, 글자 키 도구, ghost가 기즈모 평면에만 있음, 필드 편집·거절, 의존 작도 삭제, 역학 경로 세 점 + Enter.
  - alid: 아이콘 테스트 13개 통과, `tsc --noEmit` 통과.
  - **playground 수동 확인**: 작도 도구 모음과 아이콘 표시, 원 도구 두 클릭(중심 → 둘레, ghost 표시), 점 선택 후 속성의 x 값 변경, Delete로 점과 그 원 삭제, ⌘Z 한 번으로 복원. 합성 PointerEvent로 조작했다.
- 번들: 1,565,160 B (1.49 MiB).
- 미검증: 실제 마우스·트랙패드, 분할 뷰, OS 한글 IME로 라벨 입력, 120fps·0-GC.

### P4 — 역학 마감 (2026-11-05)

- 역학 편집은 P2·P3의 범용 편집기로 이미 동작한다. 부착·연결·경로 계산은 stemfig 플러그인이 하고, 어댑터는 플러그인 이름으로 분기하지 않는다. P4에서는 부족한 피드백을 채우고, stemdraw 역학 fixture로 실제 흐름을 검증했다.
- 추가: **연결 표시**. 끝점을 끌거나 도구를 쓰는 동안, 놓으면 붙을 곳(물체 연결점·작도 점은 고리, 경로 위 발은 마름모)을 기즈모 평면에 표시한다. stemfig `snap`이 근거다. Alt를 누르면 사라진다. 출판에는 들어가지 않는다.
- 검증 (`src/edit/mechanics-editing.test.ts`, 실제 커널 기본 요소, stemdraw fixture 사용):
  - 경로에 붙은 상자를 끌면 같은 경로의 위치(t)만 바뀐다(막대와 받침대).
  - 용수철 끝을 Alt로 끌면 자유점이 된다. 상자 위로 다시 끌면 `mass:top`에 붙는다. 상자를 옮기면 용수철 끝과 무게 화살표가 따라온다. 각각 실행 취소 1단위.
  - 끄는 동안 연결 표시가 나타나고, Alt면 사라진다.
  - 실 도구로 상자 A → 도르래 → 상자 B를 클릭하면 도르래를 감는 실이 한 번에 기록된다.
  - 포물선 도구로 세 번 클릭하면 포물선이 생긴다.
  - 경로 꼭짓점을 끌면 붙은 물체의 위치(t)는 유지되고 기울기가 다시 계산된다.
  - stemdraw 역학 fixture 3종(track·apparatus·projectile, figure 12개)이 붙여넣기 형식으로 정확히 보존되고, 편집 손잡이와 도구가 준비된다. 그림 바이트 일치는 P0·P1의 골든 테스트가 계속 확인한다.
- **playground 수동 확인**: apparatus fixture를 붙여넣어 그림 3개 생성. 용수철 그림 안쪽 편집에서 역학 도구 모음(stemdraw 아이콘) 표시. 용수철 끝 Alt 드래그로 분리 → 상자 위로 다시 끌 때 연결 표시 → 놓으면 다시 붙음. 속성 패널에 "연결 대상 · 연결점" 표시. 콘솔 오류 없음. 실제 마우스가 아니라 합성 포인터 이벤트와 preview 도구의 클릭으로 조작했다.
- 알려진 점: 속성의 연결 대상 이름에 라벨 원문(`$m$`)이 그대로 보인다. stemdraw의 표기이며 사본은 고치지 않는다(D3). 바꾸려면 stemdraw에서 먼저 고친다.
- 미검증: 실제 마우스·트랙패드, 분할 뷰, 120fps·0-GC.

### P5 — 문서화와 게이트 검증 (2026-11-05)

- 결정: alid 그림을 stemfig/v1 JSON으로 다시 내보내는 기능은 만들지 않는다(사용자 결정). 가져오기(붙여넣기)만 유지한다.
- `src/gates.test.ts`: 5대 게이트를 **빌드한 번들**로 **실제 Rust/Wasm 코어**(Loro·단일 Undo·정규 JSONL) 위에서 검증한다. 설치기 검증, 커널 확장 런타임, `core.clipboard`도 함께 쓴다. 로컬 alid 체크아웃과 Wasm 빌드가 없으면 건너뛴다. `pnpm test:gates`로 실행한다.
- 결과는 [GATES.md](GATES.md)에 확인한 것과 확인하지 않은 것을 나눠 기록했다.
  - Gate 1·2(자동 부분)·4·5: 통과.
  - Gate 2: OS 한글 입력기 실기는 미검증.
  - Gate 3: 120fps·0-GC를 주장하지 않는다. 측정값만 남겼다(점 끌기 한 프레임 p95 약 0.2 ms, 9개 그림 문서 출판 약 4 ms, jsdom·M3 Max). stemfig의 `apply`·`init`이 매번 새 상태를 만들어 핫패스 0-GC 조건은 지키지 않는다.
- README를 사용자 안내(설치·사용·단축키)와 개발 안내(구성·갱신 절차·검증 범위)로 다시 정리했다.
- 남은 일(계획 범위 밖):
  - 동시 편집 시 `spec` 전체 덮어쓰기 문제 해소(`@2` 어스펙트로 객체 단위 병합)
  - 하위 선택용 커널 `pickTarget` 도입
  - stemdraw 쪽 라벨 표기(`$m$ · 물체 1`) 개선
  - 실제 브라우저 성능 계측
