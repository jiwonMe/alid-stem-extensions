# 완료 게이트 검증 기록

alid의 5대 완료 게이트([AGENT.md §7](https://github.com/jiwonMe/alid/blob/main/AGENT.md))에 대해 이 확장(`jiwonme.stem` 0.6.1)이 확인한 것과 확인하지 않은 것을 구분해 적습니다. 자동 검증은 `src/gates.test.ts`가 수행합니다. 이 테스트는 실제 설치 단위와 같은 **빌드한 번들**(`dist/plugin.js`)을 다음 위에서 실행합니다.

- 로컬 alid 체크아웃의 Rust/Wasm 코어(`WasmCanvasCore`: Loro CRDT, 단일 Undo, 정규 JSONL)
- 커널(`CanvasWorld`, `ExtensionRuntimeRegistry`, `SceneVectorCompiler`)
- 설치기 검증(`repository-plugins.ts`)과 `core.clipboard` 확장

체크아웃이나 Wasm 빌드(`pnpm build:wasm`)가 없으면 이 묶음은 건너뜁니다. GitHub CI는 alid 체크아웃이 없어 이 묶음을 실행하지 않습니다.

- 측정일: 2026-11-05
- alid: `6bcc09e`
- 이 확장: 0.6.1

## Gate 1 — 정본 순수성: 통과 (자동)

- 그림을 만들고 안쪽 편집에 들어가 파생 계산, 순수 SVG 출판, 편집 화면 갱신을 반복해도 Wasm 커밋이 0회이고 `dump_canonical_jsonl()` 결과가 바이트 단위로 같습니다.
- JSONL의 그림 어스펙트 필드는 `axes·color·grid·handles·schema·spec·view`뿐입니다. 다음은 하나도 없습니다.
  - 파생 데이터: 컴파일 결과, SVG 경로, DisplayList, 폰트
  - 작도 중간 단계(`draft`)
- 작도 중간 단계는 편집기 로컬 상태와 ScratchOverlay에만 있습니다. 정본으로 쓰려 하면 예외가 납니다(`src/edit/figure-editor.ts`의 `commitProps`). 편집기 테스트가 미리보기에는 있고 정본에는 없음을 확인합니다.

## Gate 2 — 한글 IME와 단일 Undo: 통과 (자동), OS 실기 미검증

- Wasm 코어의 단일 Undo로 확인한 순서: [점 끌기 → 클릭으로 점 배치 → 속성 패널에서 "Point marks" 끄기 → (그림 생성)]을 Undo 4회로 정확히 역순 복원합니다. 각 동작은 Undo 그룹 1개입니다.
- 미완성 작도·드래그 취소(Esc)는 ScratchOverlay만 지우고 Undo 기록을 남기지 않습니다(편집기 테스트).
- 조합 중 키(`isComposing`, `keyCode 229`)와 `compositionend` 직후 16 ms의 잔여 키는 편집기가 처리하지 않습니다. 도구 전환과 편집 종료가 일어나지 않음을 확인합니다.
- 속성 패널의 텍스트 필드는 `change`(입력 확정)에서만 기록합니다. 조합 중에는 다시 그리지 않습니다.
- 미검증: macOS·Windows의 실제 한글 입력기로 라벨 입력.

## Gate 3 — 120fps와 0-GC: 미검증 (측정값만 기록)

120fps나 0-GC를 달성했다고 주장하지 않습니다. 브라우저 프레임 시간과 힙 할당은 측정하지 않았습니다. 아래는 jsdom 테스트에서 잰 **확장 코드의 계산 시간**입니다(Apple M3 Max, Node v24.11.1, 3회).

| 항목 | 값 |
| --- | --- |
| 점 끌기 한 프레임(stemfig `snap`·`apply`·`anchors`, 미리보기 쓰기, 커널 재파생), 120 프레임 | p50 0.11–0.12 ms, p95 0.18–0.19 ms |
| 그림 1개 순수 SVG 출판 | 0.03–0.04 ms |
| stemdraw 포물선 시트(그림 9개) 붙여넣은 문서 전체 출판 | 3.9–4.2 ms |

- 드래그 경로는 포인터 이벤트에서 위치만 기록하고, 계산은 호스트의 단일 프레임 콜백에서 합니다.
- 핫패스에서 객체·배열을 만들지 않는다는 조건은 **지키지 않습니다**. stemfig의 `apply`와 `init`이 매번 새 상태를 만듭니다. 0-GC를 목표로 하려면 stemdraw 엔진 쪽 변경이 필요합니다.
- 1,000개 엔티티 시나리오는 측정하지 않았습니다. 커널은 모든 파생값을 매번 다시 계산하므로 그림 수에 비례합니다. 이 확장은 같은 정본·크기면 컴파일을 재사용합니다.

## Gate 4 — 참조 무결성과 안전 격리: 통과 (자동, 범위 한정)

- 확장을 끄면 그림 데이터가 JSONL에 그대로 남고 읽기 전용이 되며, 다시 켜면 편집할 수 있습니다.
- 그림 엔티티를 지우면 Undo 1회로 복원됩니다. 엔티티 간 참조 필드는 없습니다(`refs` 없음). 그림 안의 참조(점→선분, 물체→경로 등)는 stemfig가 관리하고, 의존 작도는 함께 삭제됩니다(stemfig `remove`, 편집기 테스트).
- 설치 번들은 SHA-256으로 고정되고 설치기 검증을 통과합니다. 이 확장은 **신뢰 확장(Tier 1)**입니다. 문서 스크립트 Tier 3 격리와 무관하며 샌드박스가 아닙니다.
- 붙여넣은 stemfig JSON은 stemfig 스키마 검증을 통과한 내용만 정본에 들어갑니다. 실행 코드를 포함하지 않습니다.
- 편집 화면의 SVG에 넣는 값은 이스케이프하고, 도구 아이콘은 alid가 검증하는 path 데이터만 씁니다.

## Gate 5 — 벡터 출판 일치성: 통과 (자동)

- DOM이 하나도 마운트되지 않은 상태에서 `compileToPureSvg()`가 기하·그래프·역학 그림 3개를 모두 출판합니다. 렌더 오류가 없고 쌓임 순서(생성 순)를 지킵니다.
- 출판 결과에 `foreignObject`, 오류 상자, 편집 손잡이가 없습니다.
- 화면과 출판은 같은 `renderSvg` 문자열을 씁니다.
- stemdraw fixture 18개 figure의 그림이 stemdraw 원본 파이프라인과 바이트 단위로 같습니다(`test/golden`, `src/engine.test.ts`, `test/plugin.test.mjs`).
- 남은 차이: 한글 등 수식이 아닌 라벨은 stemdraw와 마찬가지로 시스템 글꼴 `<text>`입니다. 출판 환경의 글꼴에 따라 모양이 달라질 수 있습니다.

## 수동 확인 (playground, dev 연결)

모두 합성 포인터 이벤트로 조작했고, 실제 마우스·트랙패드로는 확인하지 않았습니다.

- **P1**: 생성 버튼과 그림 표시.
- **P2**: 점 끌기, Esc, ⌘Z.
- **P3**: 작도 도구 모음, 원 작도, 속성 변경, 의존 작도 삭제, ⌘Z.
- **P4**: 역학 fixture 붙여넣기, 용수철 끝 분리·재연결과 연결 표시.
