import { useEffect } from "react";
import { controller } from "../lib/playerController";

/**
 * HTMLAudioElement를 생성하고 PlayerController에 주입.
 * App 루트에서 한 번만 호출한다.
 */
export function useAudioEngine(): void {
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    controller.mountAudio(audio);

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);
}
