import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Track } from "../../lib/types";
import { artUrl } from "../../lib/ipc";
import { useUIStore } from "../../stores/uiStore";

interface Props {
  track: Track;
  index: number;
  style: React.CSSProperties;
  onDoubleClick?: (track: Track) => void;
  onSelect?: (track: Track, e: React.MouseEvent) => void;
  isSelected?: boolean;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "--:--";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export const TrackRow = memo(function TrackRow({
  track,
  index,
  style,
  onDoubleClick,
  onSelect,
  isSelected,
}: Props) {
  const artSrc = artUrl(track.art_cache_path);

  // useDraggable for library→playlist drag. Activation distance 5px lets clicks through.
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib:${track.id}`,
    data: { type: "track", track },
  });

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    useUIStore.getState().setContextMenu({ x: e.clientX, y: e.clientY, track });
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        opacity: isDragging ? 0.4 : 1,
        backgroundColor: isSelected
          ? "var(--color-surface-raised)"
          : undefined,
        outline: isSelected ? "1px solid var(--color-border)" : undefined,
      }}
      className="group flex items-center gap-3 px-4 select-none cursor-default"
      role="row"
      aria-rowindex={index + 1}
      aria-selected={isSelected}
      {...listeners}
      onClick={(e) => onSelect?.(track, e)}
      onDoubleClick={() => onDoubleClick?.(track)}
      onContextMenu={handleContextMenu}
    >
      {/* 트랙번호 / 앨범아트 */}
      <div className="w-8 flex-shrink-0 flex items-center justify-center">
        {artSrc ? (
          <img
            src={artSrc}
            alt=""
            width={32}
            height={32}
            className="rounded-sm object-cover"
            style={{ width: 32, height: 32 }}
          />
        ) : (
          <span
            className="text-xs tabular-nums"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            {track.track_no ?? index + 1}
          </span>
        )}
      </div>

      {/* 제목 + 아티스트 */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate leading-tight"
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

      {/* 앨범 */}
      <div className="w-48 flex-shrink-0 hidden md:block min-w-0">
        <p
          className="text-sm truncate"
          style={{ color: "var(--color-fg-muted)" }}
        >
          {track.album}
        </p>
      </div>

      {/* 재생시간 */}
      <div className="w-12 flex-shrink-0 text-right">
        <span
          className="text-xs tabular-nums"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          {formatDuration(track.duration_ms)}
        </span>
      </div>
    </div>
  );
});
