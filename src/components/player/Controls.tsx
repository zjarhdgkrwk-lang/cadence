import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { usePlayerStore } from "../../stores/playerStore";
import { controller } from "../../lib/playerController";

export function Controls() {
  const status = usePlayerStore((s) => s.status);
  const isPlaying = status === "playing" || status === "buffering";
  const isLoading = status === "loading";

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => controller.prev()}
        className="p-2 rounded-md transition-colors"
        style={{ color: "var(--color-fg-muted)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface-raised)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
        aria-label="이전 곡"
      >
        <SkipBack size={18} />
      </button>

      <button
        onClick={() => controller.toggle()}
        disabled={isLoading}
        className="p-2 rounded-full transition-colors disabled:opacity-40"
        style={{ color: "var(--color-fg)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface-raised)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
        aria-label={isPlaying ? "일시정지" : "재생"}
      >
        {isPlaying ? <Pause size={22} /> : <Play size={22} />}
      </button>

      <button
        onClick={() => controller.next()}
        className="p-2 rounded-md transition-colors"
        style={{ color: "var(--color-fg-muted)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface-raised)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
        aria-label="다음 곡"
      >
        <SkipForward size={18} />
      </button>
    </div>
  );
}
