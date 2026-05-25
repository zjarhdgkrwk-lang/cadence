import { useEffect } from "react";
import { controller } from "../lib/playerController";

/**
 * <audio> 인스턴스 두 개를 생성해 PlayerController에 주입.
 * primary(_audioA) = 현재 재생, secondary(_audioB) = 갭리스 프리로드 전용.
 * App 루트에서 한 번만 호출한다.
 */
export function useAudioEngine(): void {
  useEffect(() => {
    const primary = new Audio();
    const secondary = new Audio();
    controller.mountAudio(primary, secondary);

    return () => {
      primary.pause();
      primary.src = "";
      secondary.pause();
      secondary.src = "";
    };
  }, []);
}
