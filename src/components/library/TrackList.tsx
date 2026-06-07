import { useEffect, useRef, useCallback, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLibraryStore } from "../../stores/libraryStore";
import { useUIStore } from "../../stores/uiStore";
import { TrackRow } from "./TrackRow";
import { controller } from "../../lib/playerController";
import type { Track } from "../../lib/types";

const ROW_HEIGHT = 52;
const LOAD_AHEAD_PX = 200;

export function TrackList() {
  const { tracks, totalTracks, loadMore, isLoadingMore } = useLibraryStore();
  const selectedTrackIds = useUIStore((s) => s.selectedTrackIds);
  const { toggleSelectTrack, selectRangeTrack, clearSelection } = useUIStore.getState();
  const parentRef = useRef<HTMLDivElement>(null);

  // ── 키보드 네비게이션 상태 ──────────────────────────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleDoubleClick = useCallback(
    (track: Track) => {
      const idx = tracks.findIndex((t) => t.id === track.id);
      if (idx !== -1) controller.replaceQueueAndPlay([...tracks], idx);
    },
    [tracks]
  );

  const handleSelect = useCallback(
    (track: Track, e: React.MouseEvent) => {
      if (e.shiftKey) {
        selectRangeTrack(track.id, tracks);
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelectTrack(track.id);
      } else {
        clearSelection();
        toggleSelectTrack(track.id);
      }
    },
    [tracks, toggleSelectTrack, selectRangeTrack, clearSelection]
  );

  const rowVirtualizer = useVirtualizer({
    count: totalTracks,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // ── 무한 스크롤 ────────────────────────────────────────────────────────────
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

  // ── 포커스된 아이템이 바뀌면 스크롤 ────────────────────────────────────────
  useEffect(() => {
    if (focusedIndex !== null) {
      rowVirtualizer.scrollToIndex(focusedIndex, { behavior: "smooth" });
    }
  }, [focusedIndex, rowVirtualizer]);

  // ── 트랙 목록 변경 시 포커스 리셋 ─────────────────────────────────────────
  useEffect(() => {
    setFocusedIndex(null);
  }, [tracks]);

  // ── 컨테이너 키보드 핸들러 ────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (tracks.length === 0) return;

      if (e.code === "ArrowDown" || e.code === "ArrowUp") {
        // ↑/↓ — 리스트 내비게이션. stopPropagation으로 전역 볼륨 단축키 차단.
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) => {
          const current = prev ?? -1;
          const next =
            e.code === "ArrowDown"
              ? Math.min(current + 1, tracks.length - 1)
              : Math.max(current - 1, 0);
          return next;
        });

      } else if (e.code === "Enter" && focusedIndex !== null) {
        e.preventDefault();
        e.stopPropagation();
        const track = tracks[focusedIndex];
        if (track) {
          controller.replaceQueueAndPlay([...tracks], focusedIndex);
        }

      } else if (e.code === "ArrowRight" || e.code === "ArrowLeft") {
        // →/← — 전역 탐색 단축키에 위임 (stopPropagation 하지 않음)
      }
    },
    [tracks, focusedIndex]
  );

  const items = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto focus:outline-none"
      style={{ contain: "strict" }}
      role="listbox"
      aria-label="트랙 목록"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={() => setFocusedIndex(null)}
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
            const isFocused = focusedIndex === virtualRow.index;
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
                  // 키보드 포커스 링 (마우스 선택과 구별되는 파란 윤곽선)
                  outline: isFocused ? "2px solid var(--color-accent, #6366f1)" : undefined,
                  outlineOffset: isFocused ? "-2px" : undefined,
                }}
                onDoubleClick={handleDoubleClick}
                onSelect={handleSelect}
                isSelected={selectedTrackIds.has(track.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
