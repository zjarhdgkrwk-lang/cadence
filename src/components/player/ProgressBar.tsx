import { useState, useCallback, useRef } from "react";
import { usePlayerStore } from "../../stores/playerStore";
import { controller } from "../../lib/playerController";

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

export function ProgressBar() {
  const positionMs = usePlayerStore((s) => s.positionMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  // 트랙이 로드돼 있으면 status에 무관하게 활성 (Idle+곡없음일 때만 --:--)
  const isActive = currentTrack !== null && durationMs > 0;
  const displayPos = dragging ? dragPos : positionMs;
  const progress = durationMs > 0 ? (displayPos / durationMs) * 100 : 0;

  const posFromEvent = useCallback(
    (clientX: number): number => {
      const bar = barRef.current;
      if (!bar || !durationMs) return 0;
      const rect = bar.getBoundingClientRect();
      return (
        Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) *
        durationMs
      );
    },
    [durationMs]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!durationMs) return;
      e.preventDefault();
      const pos = posFromEvent(e.clientX);
      setDragging(true);
      setDragPos(pos);

      const onMove = (ev: MouseEvent) => setDragPos(posFromEvent(ev.clientX));
      const onUp = (ev: MouseEvent) => {
        const final = posFromEvent(ev.clientX);
        setDragging(false);
        controller.seek(final);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [durationMs, posFromEvent]
  );

  return (
    <div className="flex items-center gap-2 w-full">
      <span
        className="text-xs tabular-nums w-10 text-right select-none"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {isActive ? formatMs(displayPos) : "--:--"}
      </span>

      <div
        ref={barRef}
        className="relative flex-1 h-1 rounded-full cursor-pointer group"
        style={{ backgroundColor: "var(--color-border)" }}
        onMouseDown={onMouseDown}
      >
        {/* 진행 채움 */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${progress}%`,
            backgroundColor: "var(--color-accent)",
          }}
        />
        {/* 드래그 핸들 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{
            left: `calc(${progress}% - 6px)`,
            backgroundColor: "var(--color-accent)",
          }}
        />
      </div>

      <span
        className="text-xs tabular-nums w-10 select-none"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        {isActive ? formatMs(durationMs) : "--:--"}
      </span>
    </div>
  );
}
