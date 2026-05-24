import { useEffect } from "react";
import { controller } from "../lib/playerController";
import { usePlayerStore } from "../stores/playerStore";

/** §7.4 기본 단축키. App 루트에서 한 번만 호출. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
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
      } else if (e.code === "ArrowUp" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        controller.setVolume(
          Math.min(1, usePlayerStore.getState().volume + 0.05)
        );
      } else if (e.code === "ArrowDown" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        controller.setVolume(
          Math.max(0, usePlayerStore.getState().volume - 0.05)
        );
      } else if (e.code === "KeyS" && !e.ctrlKey && !e.metaKey) {
        controller.toggleShuffle();
      } else if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) {
        controller.cycleRepeat();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
