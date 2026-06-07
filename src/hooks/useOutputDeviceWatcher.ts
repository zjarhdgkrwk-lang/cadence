/**
 * Windows 오디오 출력 장치 변경 감시 훅.
 *
 * Rust output_watcher가 emit하는 이벤트를 수신한다:
 *   - "output_device_lost"     → output_watch_enabled가 ON이면 controller.pause()
 *   - "output_device_restored" → 자동 재생 없음 (기본 OFF, SSOT §3.15)
 *
 * 토글 설정은 app_state DB의 "output_watch_enabled" 키로 저장.
 * 기본값: "true" (ON). 추후 설정 화면에서 변경 가능.
 *
 * 주의: 이벤트는 설정이 OFF여도 수신된다. 설정 OFF = "이벤트 무시", NOT "이벤트 없음".
 */
import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { controller } from "../lib/playerController";
import { getAppState } from "../lib/ipc";

export function useOutputDeviceWatcher(): void {
  const watchEnabledRef = useRef(true); // 기본 ON

  useEffect(() => {
    // 설정 로드 (비동기, 실패 시 기본값 true 유지)
    getAppState("output_watch_enabled")
      .then((val) => {
        // 명시적으로 "false"인 경우만 OFF
        watchEnabledRef.current = val !== "false";
      })
      .catch(() => {});

    let unlisten: (() => void) | null = null;
    let unlistenRestored: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen("output_device_lost", () => {
        console.info("[output] device lost event received");
        if (watchEnabledRef.current) {
          console.info("[output] pausing playback on device lost");
          controller.pause();
        } else {
          console.info("[output] device lost — watch disabled, skipping pause");
        }
      });

      unlistenRestored = await listen("output_device_restored", () => {
        // 재연결 시 자동 재생 없음 (SSOT §3.15 기본 OFF)
        console.info("[output] device restored — no auto-resume (default OFF)");
      });
    };

    setup().catch((e) => console.warn("[output] listen 설정 실패:", e));

    return () => {
      unlisten?.();
      unlistenRestored?.();
    };
  }, []);
}
