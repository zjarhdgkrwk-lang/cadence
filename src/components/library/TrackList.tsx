import { useEffect, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLibraryStore } from "../../stores/libraryStore";
import { TrackRow } from "./TrackRow";
import { controller } from "../../lib/playerController";
import type { Track } from "../../lib/types";

const ROW_HEIGHT = 52; // px (아트 포함 시 조금 더 여유)
const LOAD_AHEAD_PX = 200;

export function TrackList() {
  const { tracks, totalTracks, loadMore, isLoadingMore } = useLibraryStore();
  const parentRef = useRef<HTMLDivElement>(null);

  // 더블클릭: 현재 로드된 목록을 큐로 교체하고 해당 곡 재생
  const handleDoubleClick = useCallback(
    (track: Track) => {
      const idx = tracks.findIndex((t) => t.id === track.id);
      if (idx !== -1) controller.replaceQueueAndPlay([...tracks], idx);
    },
    [tracks]
  );

  const rowVirtualizer = useVirtualizer({
    count: totalTracks,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // 스크롤 끝 근처에서 추가 로드
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const handler = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < LOAD_AHEAD_PX && !isLoadingMore) {
        loadMore();
      }
    };

    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [loadMore, isLoadingMore]);

  const items = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto"
      style={{ contain: "strict" }}
      role="rowgroup"
    >
      {tracks.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-full gap-2 py-20"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          <span className="text-sm">음악 파일이 없습니다.</span>
          <span className="text-xs">폴더를 추가하고 스캔을 실행해 주세요.</span>
        </div>
      ) : (
        <div
          style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
        >
          {items.map((virtualRow) => {
            const track = tracks[virtualRow.index];
            if (!track) return null;
            return (
              <TrackRow
                key={track.id}
                track={track}
                index={virtualRow.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${ROW_HEIGHT}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onDoubleClick={handleDoubleClick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
