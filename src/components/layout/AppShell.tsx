import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Sidebar } from "./Sidebar";
import { MainView } from "./MainView";
import { NowPlayingBar } from "./NowPlayingBar";

export function AppShell() {
  return (
    <div
      className="flex flex-col"
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    >
      {/* Top bar: theme toggle (temporary, will move to sidebar header) */}
      <div
        className="flex items-center justify-end px-3 h-10 shrink-0 border-b"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <ThemeToggle />
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainView />
      </div>

      {/* Now Playing bar */}
      <NowPlayingBar />
    </div>
  );
}
