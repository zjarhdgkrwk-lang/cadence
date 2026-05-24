import { useEffect, useRef } from "react";
import { LibraryHeader } from "../library/LibraryHeader";
import { TrackList } from "../library/TrackList";
import { PlaylistDetail } from "../playlists/PlaylistDetail";
import { useLibraryStore } from "../../stores/libraryStore";
import { useUIStore } from "../../stores/uiStore";

function PlaceholderView({ title }: { title: string }) {
  return (
    <main
      className="flex-1 flex items-center justify-center"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
        {title} — 준비 중 (3단계 이후 구현)
      </p>
    </main>
  );
}

export function MainView() {
  const { loadInitial, initScanListeners } = useLibraryStore();
  const { currentView } = useUIStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let cleanup: (() => void) | null = null;
    initScanListeners().then((fn) => { cleanup = fn; });
    loadInitial();

    return () => { cleanup?.(); };
  }, [loadInitial, initScanListeners]);

  if (currentView === "albums") return <PlaceholderView title="앨범" />;
  if (currentView === "artists") return <PlaceholderView title="아티스트" />;
  if (currentView === "playlist") return <PlaylistDetail />;

  return (
    <main
      className="flex-1 flex flex-col overflow-hidden"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <LibraryHeader />
      <TrackList />
    </main>
  );
}
