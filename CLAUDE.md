# Cadence — Claude Code 작업 지침

이 저장소는 **Windows 전용 로컬 음악 플레이어 "Cadence"** 입니다.

> **단일 진실 공급원(SSOT)은 `/SSOT.md` 입니다. 모든 구현은 SSOT를 따릅니다.**
> 적응형 배경 셰이더 레퍼런스 구현은 `/assets/aurora-shader-gradient.html` 입니다.

## 작업 원칙
- 구현 전 항상 `SSOT.md`의 해당 섹션을 읽고 그대로 따른다.
- SSOT와 충돌하는 결정을 임의로 하지 않는다. 모호하거나 SSOT에 없는 경우 **먼저 질문**하거나 SSOT 변경을 제안한다.
- **한 번에 하나의 구현 단계(SSOT §9)만** 진행한다. 그 단계 범위를 넘지 않는다.
- 어려운 설계(상태 머신·큐 모델·IPC·오디오 엔진)는 **먼저 계획을 제시해 확인을 받은 뒤** 구현한다.
- 비범위(SSOT §5)를 침범하지 않는다: 온라인 기능 금지, Windows 전용, 원본 파일 태그 미수정, 영구 삭제 금지(휴지통 경유) 등.
- 새 기능/의존성을 임의로 추가하지 않는다.

## 이 실행 환경의 제약 (중요)
- **Claude Code 웹은 Linux 클라우드 VM에서 실행된다. Windows용 Tauri 빌드(.exe)와 실행은 여기서 불가능하다.**
- 이 환경에서 검증할 것: 코드 작성, `cargo check` / `cargo clippy`, `tsc`(타입 체크), `npm run test` / `cargo test`(단위 테스트), 린트.
- **Windows에서만 검증 가능한 것**(반드시 PR 설명에 "Windows 검증 필요" 목록으로 명시): 실제 오디오 재생/코덱, 갭리스 체감, SMTC/미디어 키, 트레이, 출력 장치 연결 해제 감지, WebView2 거동, WebGL 배경 렌더, 최종 패키징.
- 따라서 Windows 의존 코드는 인터페이스/단위 테스트로 최대한 검증하고, 수동 확인이 필요한 부분을 분명히 표시한다.

## 기술 스택 (SSOT §2)
- 셸: Tauri 2 (Rust 백엔드) + WebView2.
- 프런트: React 19 + TypeScript + Vite + Tailwind + shadcn/ui + Zustand + @dnd-kit + Motion(framer-motion) + @tanstack/react-virtual + lucide-react.
- Rust: `walkdir`, `lofty`, `image` + `kmeans-colors`, `notify`, `tauri-plugin-sql`(SQLite + FTS5), `souvlaki`(SMTC/미디어 키), `tauri-plugin-window-state`, `trash`(휴지통 삭제), Windows 오디오 엔드포인트 watcher.
- 오디오: 프런트 HTML5 `<audio>` 2인스턴스(현재/다음). 위치 동기화는 `currentTime` + `requestAnimationFrame` 기준, `timeupdate`는 보조 only.

## 아키텍처 규칙 (SSOT §6, §12)
- 재생 제어(버튼/단축키/SMTC/트레이/출력끊김)는 전부 **단일 PlayerController + Player 상태 머신**(§12.1~12.2)을 경유한다. 입력원이 `<audio>`를 직접 만지지 않는다.
- DB는 §6 스키마를 따른다: `raw_*` / `*_override` 분리(표시값 = COALESCE override→raw→파일명), `queue_state`/`queue_items`/`queue_history`, FTS5에 태그 포함, 정렬·초성 키 사전 계산. 스키마는 마이그레이션으로 관리.
- missing 파일은 자동 삭제 금지(tombstone), 수동 "없는 파일 정리"로만 제거(§3.1).
- IPC 커맨드는 §12.4 계약을 따르고 입력/출력/오류 타입을 명시한다.

## 디자인 규칙 (SSOT §11)
- §11.1 디자인 토큰(간격/타이포/모서리/그림자/의미 기반 색)을 CSS 변수 + Tailwind 테마로 노출. 라이트 테마 기본.
- 전체 화면 재생 배경만 WebGL 셰이더(§11.2), 미니 플레이어/리스트는 솔리드 테마 배경.
- 폰트 Pretendard. 모션은 의도된 곳에만, `prefers-reduced-motion` 존중.

## PR / 커밋 규칙
- PR은 **구현 단계(§9) 단위**로 분리한다.
- PR 설명에 (1) 구현한 SSOT 섹션, (2) 추가/변경한 의존성, (3) **Windows에서 직접 검증해야 할 항목** 목록을 적는다.
- 변경마다 타입 체크와 테스트가 통과해야 한다.

## 환경 setup 명령 (예시)
- Node: `npm install`
- Rust: rustup 툴체인 설치 후 `cd src-tauri && cargo fetch`
- 검증: `npm run test` / `npm run lint` / `tsc --noEmit` / `cd src-tauri && cargo check`
