import { create } from "zustand";
import type { Playlist, Track } from "../lib/types";
import {
  listPlaylists,
  createPlaylist as ipcCreate,
  renamePlaylist as ipcRename,
  deletePlaylist as ipcDelete,
  getPlaylistTracks,
  addTracksToPlaylist as ipcAdd,
  removeTrackFromPlaylist as ipcRemove,
  reorderPlaylistItems as ipcReorder,
} from "../lib/ipc";
import type { PlaylistItemOrder } from "../lib/types";

interface PlaylistState {
  playlists: Playlist[];
  playlistTracksMap: Record<number, Track[]>;

  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  renamePlaylist: (id: number, name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  loadPlaylistTracks: (playlistId: number) => Promise<void>;
  addTracks: (playlistId: number, trackIds: number[]) => Promise<void>;
  removeTrack: (playlistId: number, trackId: number) => Promise<void>;
  setPlaylistTracks: (playlistId: number, tracks: Track[]) => void;
  reorderTracks: (playlistId: number, newTracks: Track[]) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  playlistTracksMap: {},

  async loadPlaylists() {
    const playlists = await listPlaylists();
    set({ playlists });
  },

  async createPlaylist(name) {
    const playlist = await ipcCreate(name);
    set((s) => ({ playlists: [...s.playlists, playlist] }));
    return playlist;
  },

  async renamePlaylist(id, name) {
    await ipcRename(id, name);
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === id ? { ...p, name, updated_at: Date.now() } : p
      ),
    }));
  },

  async deletePlaylist(id) {
    await ipcDelete(id);
    const { playlistTracksMap } = get();
    const newMap = { ...playlistTracksMap };
    delete newMap[id];
    set((s) => ({
      playlists: s.playlists.filter((p) => p.id !== id),
      playlistTracksMap: newMap,
    }));
  },

  async loadPlaylistTracks(playlistId) {
    const tracks = await getPlaylistTracks(playlistId);
    set((s) => ({
      playlistTracksMap: { ...s.playlistTracksMap, [playlistId]: tracks },
    }));
  },

  async addTracks(playlistId, trackIds) {
    await ipcAdd(playlistId, trackIds);
    // Reload to get correct server-side positions
    await get().loadPlaylistTracks(playlistId);
    // Update playlist updated_at optimistically
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, updated_at: Date.now() } : p
      ),
    }));
  },

  async removeTrack(playlistId, trackId) {
    await ipcRemove(playlistId, trackId);
    set((s) => ({
      playlistTracksMap: {
        ...s.playlistTracksMap,
        [playlistId]: (s.playlistTracksMap[playlistId] ?? []).filter(
          (t) => t.id !== trackId
        ),
      },
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, updated_at: Date.now() } : p
      ),
    }));
  },

  setPlaylistTracks(playlistId, tracks) {
    set((s) => ({
      playlistTracksMap: { ...s.playlistTracksMap, [playlistId]: tracks },
    }));
  },

  async reorderTracks(playlistId, newTracks) {
    const prev = get().playlistTracksMap[playlistId] ?? [];
    // Optimistic update before IPC
    set((s) => ({
      playlistTracksMap: { ...s.playlistTracksMap, [playlistId]: newTracks },
    }));
    const newOrder: PlaylistItemOrder[] = newTracks.map((t, pos) => ({
      track_id: t.id,
      position: pos,
    }));
    try {
      await ipcReorder(playlistId, newOrder);
    } catch (err) {
      // Revert on failure
      set((s) => ({
        playlistTracksMap: { ...s.playlistTracksMap, [playlistId]: prev },
      }));
      throw err;
    }
  },
}));
