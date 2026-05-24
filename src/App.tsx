import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { initThemeListeners } from "@/stores/uiStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { getAppInfo, loadQueue, getAppState } from "@/lib/ipc";
import { initLogger } from "@/lib/logger";
import { useQueueStore } from "@/stores/queueStore";
import { controller } from "@/lib/playerController";

// 가능한 한 일찍 인터셉터 설치 (모듈 평가 시점)
initLogger();

function App() {
  useAudioEngine();
  useKeyboardShortcuts();

  useEffect(() => {
    const cleanupTheme = initThemeListeners();

    async function restore() {
      try {
        const [queueData, volumeStr, mutedStr, posStr] = await Promise.all([
          loadQueue(),
          getAppState("volume"),
          getAppState("muted"),
          getAppState("current_position_ms"),
        ]);

        // 볼륨/뮤트 먼저 복원
        if (volumeStr) controller.setVolume(parseFloat(volumeStr));
        if (mutedStr) controller.setMuted(mutedStr === "true");

        if (queueData.items.length > 0) {
          const ci = Math.max(0, queueData.current_index);
          // 셔플 상태를 replaceQueue 전에 설정해야 unplayed 풀이 올바르게 빌드됨
          useQueueStore.setState({ shuffle: queueData.shuffle });
          const qs = useQueueStore.getState();
          qs.replaceQueue(queueData.items, ci);
          qs.setRepeatMode(queueData.repeat_mode);

          // 현재 곡 복원 (자동 재생 없음)
          const currentTrack = queueData.items[ci];
          const posMs = posStr ? parseFloat(posStr) : 0;
          if (currentTrack) {
            controller.restoreSession(currentTrack, posMs);
          }
        }
      } catch (e) {
        console.warn("[Cadence] 세션 복원 실패:", e);
      }
    }

    restore();

    getAppInfo()
      .then((info) => {
        console.info(`[Cadence] v${info.version}  db=${info.db_path}  log_dir=${info.log_dir}`);
      })
      .catch((err) => console.warn("[Cadence] app_info unavailable:", err));

    return cleanupTheme;
  }, []);

  return <AppShell />;
}

export default App;
