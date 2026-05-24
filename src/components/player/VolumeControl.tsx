import { Volume2, VolumeX } from "lucide-react";
import { usePlayerStore } from "../../stores/playerStore";
import { controller } from "../../lib/playerController";

export function VolumeControl() {
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const displayVol = muted ? 0 : volume;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => controller.setMuted(!muted)}
        className="p-1.5 rounded transition-colors"
        style={{ color: "var(--color-fg-muted)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface-raised)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
        aria-label={muted ? "음소거 해제" : "음소거"}
      >
        {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={displayVol}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (muted && v > 0) controller.setMuted(false);
          controller.setVolume(v);
        }}
        className="w-20"
        style={{ accentColor: "var(--color-accent)" }}
        aria-label="볼륨"
      />
    </div>
  );
}
