import { usePlayerStore } from "../stores/playerStore";
import { useQueueStore } from "../stores/queueStore";
import { saveQueue, setAppState } from "./ipc";

let _timer: ReturnType<typeof setTimeout> | null = null;

/** 상태 변경 시 호출. 1.5초 디바운스 후 DB 저장. 비정상 종료에도 복원 가능. */
export function scheduleSave(): void {
  if (_timer !== null) clearTimeout(_timer);
  _timer = setTimeout(doSave, 1500);
}

/** 즉시 저장 (앱 종료 직전 호출) */
export async function flushSave(): Promise<void> {
  if (_timer !== null) {
    clearTimeout(_timer);
    _timer = null;
  }
  await doSave();
}

async function doSave(): Promise<void> {
  _timer = null;
  const player = usePlayerStore.getState();
  const queue = useQueueStore.getState();

  try {
    await Promise.all([
      setAppState("volume", String(player.volume)),
      setAppState("muted", String(player.muted)),
      setAppState("speed", String(player.speed)),
      setAppState("replaygain_mode", player.replaygainMode),
      setAppState(
        "current_track_id",
        player.currentTrack ? String(player.currentTrack.id) : ""
      ),
      setAppState("current_position_ms", String(Math.round(player.positionMs))),
      saveQueue({
        items: queue.items.map((t, i) => ({ position: i, track_id: t.id })),
        current_index: queue.currentIndex,
        shuffle: queue.shuffle,
        repeat_mode: queue.repeatMode,
      }),
    ]);
  } catch (e) {
    console.warn("[persist] save failed:", e);
  }
}
