import { AlertCircle } from "lucide-react";
import { usePlayerStore } from "../../stores/playerStore";
import { artUrl } from "../../lib/ipc";
import { Controls } from "../player/Controls";
import { ProgressBar } from "../player/ProgressBar";
import { VolumeControl } from "../player/VolumeControl";
import { ShuffleRepeatControls } from "../player/ShuffleRepeatControls";

export function NowPlayingBar() {
  const track = usePlayerStore((s) => s.currentTrack);
  const status = usePlayerStore((s) => s.status);
  const art = artUrl(track?.art_cache_path ?? null);

  // error 상태이고 트랙이 없으면 시스템 전체 오류로 간주
  const isSystemError = status === "error" && !track;

  return (
    <footer
      className="flex items-center gap-4 px-4 shrink-0 border-t"
      style={{
        height: "var(--nowplaying-bar-h)",
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
      aria-label="현재 재생 중"
    >
      {/* 좌: 트랙 정보 (고정 너비) */}
      <div className="flex items-center gap-3 shrink-0" style={{ width: 220 }}>
        {isSystemError ? (
          <div className="flex items-center gap-2">
            <AlertCircle size={18} style={{ color: "var(--color-error, #e53e3e)", flexShrink: 0 }} />
            <p className="text-xs" style={{ color: "var(--color-error, #e53e3e)" }}>
              재생 오류 — 콘솔에서 원인 확인
            </p>
          </div>
        ) : track ? (
          <>
            {art ? (
              <img
                src={art}
                alt=""
                width={40}
                height={40}
                className="rounded shrink-0 object-cover"
                style={{ width: 40, height: 40 }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded shrink-0"
                style={{ backgroundColor: "var(--color-border)" }}
              />
            )}
            <div className="min-w-0">
              <p
                className="text-sm font-medium truncate leading-snug"
                style={{ color: "var(--color-fg)" }}
              >
                {track.title}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: "var(--color-fg-muted)" }}
              >
                {track.artist}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
            재생 중인 곡 없음
          </p>
        )}
      </div>

      {/* 중: 컨트롤 + 진행 바 */}
      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
        <Controls />
        <ProgressBar />
      </div>

      {/* 우: 셔플/반복 + 볼륨 */}
      <div
        className="flex items-center gap-2 shrink-0 justify-end"
        style={{ width: 200 }}
      >
        <ShuffleRepeatControls />
        <VolumeControl />
      </div>
    </footer>
  );
}
