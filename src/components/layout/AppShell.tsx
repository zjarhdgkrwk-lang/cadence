import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Sidebar } from "./Sidebar";
import { MainView } from "./MainView";
import { NowPlayingBar } from "./NowPlayingBar";
import { QueuePanel } from "@/components/queue/QueuePanel";
import { LyricsView } from "@/components/lyrics/LyricsView";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { TrackTagAssign } from "@/components/tags/TrackTagAssign";
import { useUIStore } from "@/stores/uiStore";
import { useQueueStore } from "@/stores/queueStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { adjustCurrentIndex, snapCenterToCursor } from "@/lib/dndUtils";
import { artUrl } from "@/lib/ipc";
import type { Track } from "@/lib/types";

interface ActiveDrag {
  type: string;
  track?: Track;
  /** > 1 when multiple library tracks are being dragged as a group */
  count: number;
}

export function AppShell() {
  const rightPanel = useUIStore((s) => s.rightPanel);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const data = e.active.data.current;
    if (!data) return;
    const track = data.track as Track | undefined;
    const { selectedTrackIds } = useUIStore.getState();
    // Drag entire selection when the dragged library track is part of it
    const count =
      track && data.type === "track" && selectedTrackIds.size > 1 && selectedTrackIds.has(track.id)
        ? selectedTrackIds.size
        : 1;
    setActiveDrag({ type: data.type as string, track, count });
  }, []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;

    const aData = active.data.current;
    const oData = over.data.current;
    if (!aData || !oData) return;

    const aType = aData.type as string;
    const oType = oData.type as string;

    // ── 큐 재정렬 ────────────────────────────────────────────────
    if (aType === "queue-item" && oType === "queue-item") {
      const fromIdx = aData.index as number;
      const toIdx = oData.index as number;
      if (fromIdx === toIdx) return;
      const { items, currentIndex, reorderItems } = useQueueStore.getState();
      const newItems = arrayMove([...items], fromIdx, toIdx);
      const newCurrent = adjustCurrentIndex(currentIndex, fromIdx, toIdx);
      reorderItems(newItems, newCurrent);
      console.info(`[dnd] queue reorder: ${fromIdx} → ${toIdx}`);
    }

    // ── 플레이리스트 재정렬 ──────────────────────────────────────
    if (aType === "playlist-item" && oType === "playlist-item") {
      const fromIdx = aData.index as number;
      const toIdx = oData.index as number;
      const playlistId = aData.playlistId as number;
      if (fromIdx === toIdx) return;
      const store = usePlaylistStore.getState();
      const current = store.playlistTracksMap[playlistId] ?? [];
      const newTracks = arrayMove([...current], fromIdx, toIdx);
      store.reorderTracks(playlistId, newTracks).catch((err) => {
        console.error(`[dnd] playlist ${playlistId} reorder failed:`, err);
      });
      console.info(`[dnd] playlist ${playlistId} reorder: ${fromIdx} → ${toIdx}`);
    }

    // ── 라이브러리 트랙 → 플레이리스트 드롭 ────────────────────
    if (aType === "track" && oType === "playlist") {
      const track = aData.track as Track;
      const playlistId = oData.playlistId as number;
      const { selectedTrackIds } = useUIStore.getState();
      // When the dragged track is part of a multi-selection, add all selected tracks
      const trackIds =
        selectedTrackIds.size > 1 && selectedTrackIds.has(track.id)
          ? [...selectedTrackIds]
          : [track.id];
      usePlaylistStore.getState().addTracks(playlistId, trackIds).catch((err) => {
        console.error(`[dnd] add ${trackIds.length}곡 to playlist ${playlistId} failed:`, err);
      });
      console.info(`[dnd] ${trackIds.length}곡 → playlist ${playlistId}`);
    }
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex flex-col"
        style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-end px-3 h-10 shrink-0 border-b"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <ThemeToggle />
        </div>

        {/* Main layout: sidebar + content + right panel */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <MainView />

          {rightPanel && (
            <aside
              className="flex-shrink-0 border-l overflow-hidden flex flex-col"
              style={{
                width: 280,
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              {rightPanel === "queue" ? <QueuePanel /> : <LyricsView />}
            </aside>
          )}
        </div>

        {/* Now Playing bar */}
        <NowPlayingBar />

        {/* Global context menu */}
        <ContextMenu />

        {/* Global tag assign dialog */}
        <TrackTagAssign />
      </div>

      {/* Drag overlay — library row uses cursor-center snap; handle-based lists use default */}
      <DragOverlay
        dropAnimation={null}
        modifiers={activeDrag?.type === "track" ? [snapCenterToCursor] : []}
      >
        {activeDrag && (() => {
          const art = artUrl(activeDrag.track?.art_cache_path ?? null);
          return (
            <div
              className="flex items-center gap-2.5 rounded border shadow-xl px-3 pointer-events-none"
              style={{
                height: 52,
                minWidth: 220,
                maxWidth: 320,
                backgroundColor: "var(--color-surface-raised)",
                borderColor: "var(--color-accent, var(--color-border))",
                opacity: 0.95,
              }}
            >
              {activeDrag.count > 1 ? (
                <>
                  <span
                    className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0"
                    style={{
                      backgroundColor: "var(--color-accent, #6366f1)",
                      color: "#fff",
                    }}
                  >
                    {activeDrag.count}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
                    {activeDrag.count}곡
                  </span>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-sm flex-shrink-0 overflow-hidden bg-[var(--color-surface)] flex items-center justify-center">
                    {art ? (
                      <img src={art} alt="" width={28} height={28} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-[10px]" style={{ color: "var(--color-fg-subtle)" }}>♪</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight" style={{ color: "var(--color-fg)" }}>
                      {activeDrag.track?.title ?? "—"}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--color-fg-muted)" }}>
                      {activeDrag.track?.artist ?? ""}
                    </p>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
}
