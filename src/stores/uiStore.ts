import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "../lib/types";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type LibraryView = "tracks" | "albums" | "artists" | "playlist";
export type RightPanel = "queue" | "lyrics" | null;

export interface ContextMenuState {
  x: number;
  y: number;
  track: Track;
  playlistId?: number;
}

interface UIState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  prefersReducedMotion: boolean;
  currentView: LibraryView;
  rightPanel: RightPanel;
  selectedPlaylistId: number | null;
  contextMenu: ContextMenuState | null;
  setTheme: (theme: Theme) => void;
  setView: (view: LibraryView) => void;
  setRightPanel: (panel: RightPanel) => void;
  setSelectedPlaylistId: (id: number | null) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  _resolveTheme: (mediaMatches: boolean) => void;
}

function getSystemDark(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: "light" as Theme,
      resolvedTheme: "light" as ResolvedTheme,
      prefersReducedMotion: false,
      currentView: "tracks" as LibraryView,
      rightPanel: null as RightPanel,
      selectedPlaylistId: null,
      contextMenu: null,

      setView(view: LibraryView) {
        set({ currentView: view });
      },

      setRightPanel(panel: RightPanel) {
        set({ rightPanel: panel });
      },

      setSelectedPlaylistId(id: number | null) {
        set({ selectedPlaylistId: id });
      },

      setContextMenu(menu: ContextMenuState | null) {
        set({ contextMenu: menu });
      },

      setTheme(theme: Theme) {
        const resolved: ResolvedTheme =
          theme === "system" ? (getSystemDark() ? "dark" : "light") : theme;
        applyTheme(resolved);
        set({ theme, resolvedTheme: resolved });
      },

      _resolveTheme(mediaMatches: boolean) {
        const { theme } = get();
        if (theme !== "system") return;
        const resolved: ResolvedTheme = mediaMatches ? "dark" : "light";
        applyTheme(resolved);
        set({ resolvedTheme: resolved });
      },
    }),
    {
      name: "cadence-ui",
      partialize: (s) => ({ theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const theme = state.theme;
        const resolved: ResolvedTheme =
          theme === "system" ? (getSystemDark() ? "dark" : "light") : theme;
        applyTheme(resolved);
        state.resolvedTheme = resolved;
        state.prefersReducedMotion = getReducedMotion();
      },
    }
  )
);

export function initThemeListeners() {
  const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    useUIStore.getState()._resolveTheme(e.matches);
  };
  darkMq.addEventListener("change", handler);

  const { theme, resolvedTheme } = useUIStore.getState();
  const initResolved: ResolvedTheme =
    theme === "system" ? (darkMq.matches ? "dark" : "light") : theme;
  if (initResolved !== resolvedTheme) {
    applyTheme(initResolved);
    useUIStore.setState({ resolvedTheme: initResolved });
  }

  return () => darkMq.removeEventListener("change", handler);
}
