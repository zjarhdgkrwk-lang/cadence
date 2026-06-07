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

  // ── 다중 선택 ────────────────────────────────────────────────────────────
  selectedTrackIds: Set<number>;
  lastClickedTrackId: number | null;

  // ── 태그 다이얼로그 ──────────────────────────────────────────────────────
  tagDialogOpen: boolean;
  tagDialogTrackIds: number[];

  // ── 전체 화면 재생 뷰 (Phase 10 예정) ────────────────────────────────────
  // Esc 우선순위: nowPlayingExpanded → rightPanel 순으로 닫음
  nowPlayingExpanded: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────
  setTheme: (theme: Theme) => void;
  setView: (view: LibraryView) => void;
  setRightPanel: (panel: RightPanel) => void;
  setNowPlayingExpanded: (v: boolean) => void;
  setSelectedPlaylistId: (id: number | null) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  toggleSelectTrack: (id: number) => void;
  selectRangeTrack: (id: number, tracks: Track[]) => void;
  clearSelection: () => void;
  openTagDialog: (trackIds: number[]) => void;
  closeTagDialog: () => void;
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
      selectedTrackIds: new Set<number>(),
      lastClickedTrackId: null,
      tagDialogOpen: false,
      tagDialogTrackIds: [],
      nowPlayingExpanded: false,

      setView(view: LibraryView) {
        set({ currentView: view });
      },

      setRightPanel(panel: RightPanel) {
        set({ rightPanel: panel });
      },

      setNowPlayingExpanded(v: boolean) {
        set({ nowPlayingExpanded: v });
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

      toggleSelectTrack(id: number) {
        const { selectedTrackIds } = get();
        const next = new Set(selectedTrackIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        set({ selectedTrackIds: next, lastClickedTrackId: id });
      },

      selectRangeTrack(id: number, tracks: Track[]) {
        const { lastClickedTrackId, selectedTrackIds } = get();
        if (!lastClickedTrackId) {
          const next = new Set(selectedTrackIds);
          next.add(id);
          set({ selectedTrackIds: next, lastClickedTrackId: id });
          return;
        }
        const fromIdx = tracks.findIndex((t) => t.id === lastClickedTrackId);
        const toIdx = tracks.findIndex((t) => t.id === id);
        if (fromIdx === -1 || toIdx === -1) return;
        const [lo, hi] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        const next = new Set(selectedTrackIds);
        for (let i = lo; i <= hi; i++) next.add(tracks[i].id);
        set({ selectedTrackIds: next, lastClickedTrackId: id });
      },

      clearSelection() {
        set({ selectedTrackIds: new Set(), lastClickedTrackId: null });
      },

      openTagDialog(trackIds: number[]) {
        set({ tagDialogOpen: true, tagDialogTrackIds: trackIds });
      },

      closeTagDialog() {
        set({ tagDialogOpen: false, tagDialogTrackIds: [] });
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
