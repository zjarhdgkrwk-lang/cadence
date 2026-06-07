/**
 * §7.4 기본 단축키 — 창 포커스 한정.
 *
 * 미디어 키(하드웨어 재생/정지/이전/다음)는 souvlaki가 OS 수준에서 처리하므로
 * 이 훅에서 별도 등록하지 않는다. (useMediaKeyListener가 Tauri 이벤트로 수신)
 *
 * 창이 숨겨진(트레이 상태) 경우 창이 포커스를 잃으므로 이 단축키들은
 * 작동하지 않는다 — 이는 의도된 동작이다. 트레이 상태에서의 제어는
 * 미디어 키 또는 트레이 메뉴로만 가능.
 *
 * ↑/↓ 볼륨 조절은 리스트 컴포넌트(TrackList 등)가 포커스를 가진 경우
 * stopPropagation으로 차단되어 리스트 네비게이션이 우선한다.
 *
 * Esc 우선순위: nowPlayingExpanded(Phase 10) → rightPanel 순으로 닫음.
 */
import { useEffect } from "react";
import { controller } from "../lib/playerController";
import { usePlayerStore } from "../stores/playerStore";
import { useUIStore } from "../stores/uiStore";

const SEEK_STEP_MS = 5_000; // →/← 단축 탐색 단위 (5초)

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // 입력 필드에서는 단축키 비활성
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.code === "Space" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        controller.toggle();

      } else if (e.code === "ArrowRight" && e.ctrlKey) {
        e.preventDefault();
        controller.next();

      } else if (e.code === "ArrowLeft" && e.ctrlKey) {
        e.preventDefault();
        controller.prev();

      } else if (e.code === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
        // 단축 탐색 +5초 (리스트 포커스 시 stopPropagation으로 차단 가능)
        e.preventDefault();
        const { positionMs, durationMs } = usePlayerStore.getState();
        const target_ms = Math.min(positionMs + SEEK_STEP_MS, durationMs);
        controller.seek(target_ms);

      } else if (e.code === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
        // 단축 탐색 -5초
        e.preventDefault();
        const { positionMs } = usePlayerStore.getState();
        controller.seek(Math.max(0, positionMs - SEEK_STEP_MS));

      } else if (e.code === "ArrowUp" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        controller.setVolume(Math.min(1, usePlayerStore.getState().volume + 0.05));

      } else if (e.code === "ArrowDown" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        controller.setVolume(Math.max(0, usePlayerStore.getState().volume - 0.05));

      } else if (e.code === "KeyS" && !e.ctrlKey && !e.metaKey) {
        controller.toggleShuffle();

      } else if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) {
        controller.cycleRepeat();

      } else if (e.code === "KeyF" && e.ctrlKey) {
        e.preventDefault();
        // 검색 입력에 포커스 — LibraryHeader가 이 이벤트를 수신
        window.dispatchEvent(new CustomEvent("cadence:search-focus"));

      } else if (e.code === "Escape") {
        // Esc 우선순위:
        //   1. 전체 화면 재생 뷰 닫기 (Phase 10 예정 — nowPlayingExpanded)
        //   2. 우측 패널(큐/가사) 닫기
        const ui = useUIStore.getState();
        if (ui.nowPlayingExpanded) {
          ui.setNowPlayingExpanded(false);
        } else if (ui.rightPanel !== null) {
          ui.setRightPanel(null);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
