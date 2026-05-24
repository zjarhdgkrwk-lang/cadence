import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Sidebar } from "./Sidebar";
import { MainView } from "./MainView";
import { NowPlayingBar } from "./NowPlayingBar";
import { QueuePanel } from "@/components/queue/QueuePanel";
import { LyricsView } from "@/components/lyrics/LyricsView";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { useUIStore } from "@/stores/uiStore";

export function AppShell() {
  const rightPanel = useUIStore((s) => s.rightPanel);

  return (
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
    </div>
  );
}
