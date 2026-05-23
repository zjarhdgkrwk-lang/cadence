import { create } from "zustand";
import {
  getTracks,
  searchTracks,
  listFolders,
  onScanProgress,
  onScanComplete,
} from "../lib/ipc";
import type {
  Track,
  FolderEntry,
  ScanProgress,
  SortField,
  SortDir,
} from "../lib/types";

const PAGE_SIZE = 200;

interface LibraryState {
  // 트랙 목록
  tracks: Track[];
  totalTracks: number;
  loadedPages: number;
  isLoadingMore: boolean;

  // 폴더
  folders: FolderEntry[];

  // 스캔
  scanProgress: ScanProgress | null;
  isScanning: boolean;

  // 정렬·검색
  sortField: SortField;
  sortDir: SortDir;
  searchQuery: string;

  // 액션
  loadFolders: () => Promise<void>;
  loadInitial: () => Promise<void>;
  loadMore: () => Promise<void>;
  setSort: (field: SortField, dir?: SortDir) => void;
  setSearch: (query: string) => void;
  refreshAfterScan: () => Promise<void>;
  initScanListeners: () => Promise<() => void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  totalTracks: 0,
  loadedPages: 0,
  isLoadingMore: false,

  folders: [],

  scanProgress: null,
  isScanning: false,

  sortField: "artist",
  sortDir: "asc",
  searchQuery: "",

  loadFolders: async () => {
    const folders = await listFolders();
    set({ folders });
  },

  loadInitial: async () => {
    const { sortField, sortDir, searchQuery } = get();
    const result = searchQuery.trim()
      ? await searchTracks(searchQuery, 0, PAGE_SIZE)
      : await getTracks({ sortField, sortDir, offset: 0, limit: PAGE_SIZE });
    set({ tracks: result.tracks, totalTracks: result.total, loadedPages: 1 });
  },

  loadMore: async () => {
    const { tracks, totalTracks, loadedPages, isLoadingMore, sortField, sortDir, searchQuery } =
      get();
    if (isLoadingMore || tracks.length >= totalTracks) return;

    set({ isLoadingMore: true });
    const offset = loadedPages * PAGE_SIZE;
    const result = searchQuery.trim()
      ? await searchTracks(searchQuery, offset, PAGE_SIZE)
      : await getTracks({ sortField, sortDir, offset, limit: PAGE_SIZE });

    set((s) => ({
      tracks: [...s.tracks, ...result.tracks],
      loadedPages: s.loadedPages + 1,
      isLoadingMore: false,
    }));
  },

  setSort: (field, dir) => {
    const current = get();
    const newDir: SortDir =
      dir ?? (current.sortField === field && current.sortDir === "asc" ? "desc" : "asc");
    set({ sortField: field, sortDir: newDir, tracks: [], loadedPages: 0 });
    get().loadInitial();
  },

  setSearch: (query) => {
    set({ searchQuery: query, tracks: [], loadedPages: 0 });
    get().loadInitial();
  },

  refreshAfterScan: async () => {
    set({ tracks: [], loadedPages: 0, isScanning: false, scanProgress: null });
    await get().loadFolders();
    await get().loadInitial();
  },

  initScanListeners: async () => {
    const unProgress = await onScanProgress((p) => {
      set({ scanProgress: p, isScanning: true });
    });
    const unComplete = await onScanComplete(() => {
      get().refreshAfterScan();
    });
    return () => {
      unProgress();
      unComplete();
    };
  },
}));
