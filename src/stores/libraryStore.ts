import { create } from "zustand";
import {
  getTracks,
  searchTracksV2,
  listFolders,
  onScanProgress,
  onScanComplete,
} from "../lib/ipc";
import type {
  Track,
  FolderEntry,
  ScanProgress,
  SearchField,
  SortField,
  SortDir,
  TagFilterMode,
} from "../lib/types";

const PAGE_SIZE = 200;
const ALL_FIELDS: SearchField[] = ["title", "artist", "album", "tags"];

interface LibraryState {
  tracks: Track[];
  totalTracks: number;
  loadedPages: number;
  isLoadingMore: boolean;

  folders: FolderEntry[];

  scanProgress: ScanProgress | null;
  isScanning: boolean;

  sortField: SortField;
  sortDir: SortDir;
  searchQuery: string;
  searchFields: SearchField[];
  activeTagIds: number[];
  searchTagIds: number[];
  tagFilterMode: TagFilterMode;

  // ── Actions ──────────────────────────────────────────────────────────────
  loadFolders: () => Promise<void>;
  loadInitial: () => Promise<void>;
  loadMore: () => Promise<void>;
  setSort: (field: SortField, dir?: SortDir) => void;
  setSearch: (query: string) => void;
  setSearchAndTags: (query: string, tagIds: number[]) => void;
  setSearchFields: (fields: SearchField[]) => void;
  toggleTagFilter: (tagId: number) => void;
  setTagFilterMode: (mode: TagFilterMode) => void;
  clearTagFilter: () => void;
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
  searchFields: ALL_FIELDS,
  activeTagIds: [],
  searchTagIds: [],
  tagFilterMode: "or",

  loadFolders: async () => {
    const folders = await listFolders();
    set({ folders });
  },

  loadInitial: async () => {
    const { sortField, sortDir, searchQuery, searchFields, activeTagIds, searchTagIds, tagFilterMode } = get();
    const combinedTagIds = [...new Set([...activeTagIds, ...searchTagIds])];
    const hasFilter = searchQuery.trim() || combinedTagIds.length > 0;

    const result = hasFilter
      ? await searchTracksV2({
          query: searchQuery.trim() || undefined,
          fields: searchFields,
          tagIds: combinedTagIds.length > 0 ? combinedTagIds : undefined,
          tagMode: tagFilterMode,
          offset: 0,
          limit: PAGE_SIZE,
        })
      : await getTracks({ sortField, sortDir, offset: 0, limit: PAGE_SIZE });

    set({ tracks: result.tracks, totalTracks: result.total, loadedPages: 1 });
  },

  loadMore: async () => {
    const {
      tracks, totalTracks, loadedPages, isLoadingMore,
      sortField, sortDir, searchQuery, searchFields, activeTagIds, searchTagIds, tagFilterMode,
    } = get();
    if (isLoadingMore || tracks.length >= totalTracks) return;

    set({ isLoadingMore: true });
    const offset = loadedPages * PAGE_SIZE;
    const combinedTagIds = [...new Set([...activeTagIds, ...searchTagIds])];
    const hasFilter = searchQuery.trim() || combinedTagIds.length > 0;

    const result = hasFilter
      ? await searchTracksV2({
          query: searchQuery.trim() || undefined,
          fields: searchFields,
          tagIds: combinedTagIds.length > 0 ? combinedTagIds : undefined,
          tagMode: tagFilterMode,
          offset,
          limit: PAGE_SIZE,
        })
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

  setSearchAndTags: (query, tagIds) => {
    set({ searchQuery: query, searchTagIds: tagIds, tracks: [], loadedPages: 0 });
    get().loadInitial();
  },

  setSearchFields: (fields) => {
    set({ searchFields: fields.length > 0 ? fields : ALL_FIELDS, tracks: [], loadedPages: 0 });
    get().loadInitial();
  },

  toggleTagFilter: (tagId) => {
    const { activeTagIds } = get();
    const next = activeTagIds.includes(tagId)
      ? activeTagIds.filter((id) => id !== tagId)
      : [...activeTagIds, tagId];
    set({ activeTagIds: next, tracks: [], loadedPages: 0 });
    get().loadInitial();
  },

  setTagFilterMode: (mode) => {
    const { activeTagIds } = get();
    set({ tagFilterMode: mode });
    if (activeTagIds.length > 0) {
      set({ tracks: [], loadedPages: 0 });
      get().loadInitial();
    }
  },

  clearTagFilter: () => {
    const { activeTagIds } = get();
    if (activeTagIds.length === 0) return;
    set({ activeTagIds: [], tracks: [], loadedPages: 0 });
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
