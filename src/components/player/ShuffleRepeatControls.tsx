import { Shuffle, Repeat, Repeat1 } from "lucide-react";
import { useQueueStore } from "../../stores/queueStore";
import { controller } from "../../lib/playerController";
import type { RepeatMode } from "../../lib/types";

const REPEAT_LABEL: Record<RepeatMode, string> = {
  no_repeat: "반복 없음",
  repeat_all: "전체 반복",
  repeat_one: "한 곡 반복",
  one_track: "한 곡만",
};

function RepeatButton({
  mode,
  onClick,
}: {
  mode: RepeatMode;
  onClick: () => void;
}) {
  const active = mode !== "no_repeat";
  return (
    <button
      onClick={onClick}
      className="relative p-1.5 rounded transition-colors"
      style={{ color: active ? "var(--color-accent)" : "var(--color-fg-muted)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--color-surface-raised)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
      aria-label={REPEAT_LABEL[mode]}
      title={REPEAT_LABEL[mode]}
      aria-pressed={active}
    >
      {mode === "repeat_one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
      {/* "한 곡만" 모드 표시 배지 */}
      {mode === "one_track" && (
        <span
          className="absolute bottom-0.5 right-0.5 text-[7px] font-bold leading-none"
          style={{ color: "var(--color-accent)" }}
        >
          1
        </span>
      )}
    </button>
  );
}

export function ShuffleRepeatControls() {
  const shuffle = useQueueStore((s) => s.shuffle);
  const repeatMode = useQueueStore((s) => s.repeatMode);

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => controller.toggleShuffle()}
        className="p-1.5 rounded transition-colors"
        style={{
          color: shuffle ? "var(--color-accent)" : "var(--color-fg-muted)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface-raised)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
        aria-label={shuffle ? "셔플 끄기" : "셔플 켜기"}
        aria-pressed={shuffle}
      >
        <Shuffle size={16} />
      </button>

      <RepeatButton mode={repeatMode} onClick={() => controller.cycleRepeat()} />
    </div>
  );
}
