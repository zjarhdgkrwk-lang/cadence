import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { usePlayerStore } from "../../stores/playerStore";
import { useLyrics } from "../../hooks/useLyrics";

export function LyricsView() {
  const track = usePlayerStore((s) => s.currentTrack);
  const { lines, activeTimeMs, loading, offsetMs, adjustOffset } = useLyrics(track);
  const activeRef = useRef<HTMLDivElement | null>(null);

  // Scroll first line of active group into view on group transition
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeTimeMs]);

  if (!track) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
          재생 중인 곡 없음
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
          가사 로딩 중…
        </p>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
          가사 없음
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Offset controls */}
      <div
        className="flex items-center justify-end gap-2 px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          오프셋 {offsetMs >= 0 ? "+" : ""}{offsetMs}ms
        </span>
        <button
          onClick={() => adjustOffset(-100)}
          className="p-1 rounded hover:bg-[var(--color-surface-raised)]"
          title="오프셋 -100ms"
          aria-label="오프셋 -100ms"
        >
          <Minus size={14} style={{ color: "var(--color-fg-muted)" }} />
        </button>
        <button
          onClick={() => adjustOffset(100)}
          className="p-1 rounded hover:bg-[var(--color-surface-raised)]"
          title="오프셋 +100ms"
          aria-label="오프셋 +100ms"
        >
          <Plus size={14} style={{ color: "var(--color-fg-muted)" }} />
        </button>
      </div>

      {/* Lyrics list */}
      <div className="flex-1 overflow-y-auto py-4">
        {(() => {
          let firstActiveAttached = false;
          return lines.map((line, idx) => {
            const isActive = activeTimeMs >= 0 && line.timeMs === activeTimeMs;
            // Attach scroll ref to the first line of the active group only
            const attachRef = isActive && !firstActiveAttached;
            if (attachRef) firstActiveAttached = true;
            return (
              <div
                key={idx}
                ref={attachRef ? activeRef : undefined}
                className="px-6 py-1 text-center transition-all duration-200"
                style={{
                  color: isActive ? "var(--color-fg)" : "var(--color-fg-muted)",
                  fontWeight: isActive ? 600 : undefined,
                  fontSize: isActive ? "1rem" : "0.875rem",
                }}
              >
                {line.text || " "}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
