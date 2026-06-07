/**
 * Tauri "media_key_event" 이벤트 수신 → PlayerController 라우팅.
 *
 * 이벤트 발생원:
 *   - souvlaki SMTC 콜백 (미디어 키 / BT 리모컨)
 *   - 트레이 메뉴 클릭 (play_pause / next / prev)
 *
 * 모든 외부 입력이 단일 PlayerController를 경유하므로 SMTC·트레이·UI 버튼이
 * 동일한 상태 머신 경로를 사용한다 (SSOT §12.2).
 *
 * 50ms 디바운스: SMTC 클릭과 UI 버튼 클릭이 거의 동시에 들어오는 race 방어.
 */
import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { controller } from "../lib/playerController";
import type { IPlayerController } from "../lib/playerController";

/** 미디어 키 액션 라우팅. 테스트에서 직접 호출 가능하도록 export. */
export function routeMediaKeyAction(
  action: string,
  ctrl: Pick<IPlayerController, "toggle" | "next" | "prev" | "pause">
): void {
  switch (action) {
    case "play_pause":
      ctrl.toggle();
      break;
    case "next":
      ctrl.next();
      break;
    case "prev":
      ctrl.prev();
      break;
    case "stop":
      ctrl.pause();
      break;
    default:
      console.warn(`[media_key] unknown action: ${action}`);
  }
}

export function useMediaKeyListener(): void {
  const lastActionRef = useRef<string | null>(null);
  const lastActionTimeRef = useRef(0);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      unlisten = await listen<string>("media_key_event", (event) => {
        const action = event.payload;
        const now = Date.now();

        // 50ms 내 동일 액션 중복 무시 (SMTC + UI 동시 클릭 race 방어)
        if (action === lastActionRef.current && now - lastActionTimeRef.current < 50) {
          return;
        }
        lastActionRef.current = action;
        lastActionTimeRef.current = now;

        console.info(`[media_key] action=${action}`);
        routeMediaKeyAction(action, controller);
      });
    };

    setup().catch((e) => console.warn("[media_key] listen 설정 실패:", e));

    return () => {
      unlisten?.();
    };
  }, []);
}
