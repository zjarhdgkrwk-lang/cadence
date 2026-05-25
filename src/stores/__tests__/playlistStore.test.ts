import { describe, beforeEach, it, expect, vi } from "vitest";
import { usePlaylistStore } from "../playlistStore";
import type { Playlist, Track } from "../../lib/types";

// Mock IPC layer
vi.mock("../../lib/ipc", () => ({
  listPlaylists: vi.fn(),
  createPlaylist: vi.fn(),
  renamePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  getPlaylistTracks: vi.fn(),
  addTracksToPlaylist: vi.fn(),
  removeTrackFromPlaylist: vi.fn(),
}));

import * as ipc from "../../lib/ipc";

function mkPlaylist(id: number, name = `Playlist ${id}`): Playlist {
  return { id, name, created_at: 0, updated_at: 0 };
}

function mkTrack(id: number): Track {
  return {
    id,
    path: `/music/track${id}.mp3`,
    filename: `track${id}.mp3`,
    title: `Track ${id}`,
    artist: "Artist",
    album: "Album",
    album_artist: null,
    genre: null,
    track_no: null,
    disc_no: null,
    year: null,
    duration_ms: 180_000,
    bitrate: null,
    codec: null,
    has_embedded_art: false,
    art_cache_path: null,
    dominant_color: null,
    lrc_path: null,
    lrc_offset_ms: 0,
    lyrics_source: "none",
    missing: false,
    date_added: 0,
    last_played_at: null,
    play_count: 0,
    replaygain_track_gain: null,
    replaygain_album_gain: null,
  };
}

function reset() {
  usePlaylistStore.setState({ playlists: [], playlistTracksMap: {} });
}

describe("playlistStore", () => {
  beforeEach(() => {
    reset();
    vi.clearAllMocks();
  });

  describe("loadPlaylists", () => {
    it("IPC에서 가져온 목록으로 state 업데이트", async () => {
      const list = [mkPlaylist(1), mkPlaylist(2)];
      vi.mocked(ipc.listPlaylists).mockResolvedValue(list);
      await usePlaylistStore.getState().loadPlaylists();
      expect(usePlaylistStore.getState().playlists).toEqual(list);
    });
  });

  describe("createPlaylist", () => {
    it("IPC 호출 후 playlists에 추가", async () => {
      const p = mkPlaylist(1, "Chill");
      vi.mocked(ipc.createPlaylist).mockResolvedValue(p);
      const result = await usePlaylistStore.getState().createPlaylist("Chill");
      expect(result).toEqual(p);
      expect(usePlaylistStore.getState().playlists).toContainEqual(p);
    });
  });

  describe("renamePlaylist", () => {
    it("이름 변경 후 state 업데이트", async () => {
      usePlaylistStore.setState({ playlists: [mkPlaylist(1, "Old")] });
      vi.mocked(ipc.renamePlaylist).mockResolvedValue(undefined);
      await usePlaylistStore.getState().renamePlaylist(1, "New");
      const p = usePlaylistStore.getState().playlists[0];
      expect(p.name).toBe("New");
    });
  });

  describe("deletePlaylist", () => {
    it("playlists 및 playlistTracksMap에서 제거", async () => {
      const tracks = [mkTrack(1)];
      usePlaylistStore.setState({
        playlists: [mkPlaylist(1), mkPlaylist(2)],
        playlistTracksMap: { 1: tracks, 2: [] },
      });
      vi.mocked(ipc.deletePlaylist).mockResolvedValue(undefined);
      await usePlaylistStore.getState().deletePlaylist(1);
      const s = usePlaylistStore.getState();
      expect(s.playlists).toHaveLength(1);
      expect(s.playlists[0].id).toBe(2);
      expect(s.playlistTracksMap[1]).toBeUndefined();
    });
  });

  describe("loadPlaylistTracks", () => {
    it("playlistTracksMap에 트랙 저장", async () => {
      const tracks = [mkTrack(1), mkTrack(2)];
      vi.mocked(ipc.getPlaylistTracks).mockResolvedValue(tracks);
      await usePlaylistStore.getState().loadPlaylistTracks(5);
      expect(usePlaylistStore.getState().playlistTracksMap[5]).toEqual(tracks);
    });
  });

  describe("addTracks", () => {
    it("IPC 호출 후 loadPlaylistTracks 재호출로 갱신", async () => {
      const tracks = [mkTrack(1), mkTrack(2)];
      usePlaylistStore.setState({
        playlists: [mkPlaylist(1)],
        playlistTracksMap: { 1: [mkTrack(1)] },
      });
      vi.mocked(ipc.addTracksToPlaylist).mockResolvedValue(undefined);
      vi.mocked(ipc.getPlaylistTracks).mockResolvedValue(tracks);
      await usePlaylistStore.getState().addTracks(1, [2]);
      expect(usePlaylistStore.getState().playlistTracksMap[1]).toEqual(tracks);
    });
  });

  describe("removeTrack", () => {
    it("playlistTracksMap에서 해당 트랙 제거", async () => {
      usePlaylistStore.setState({
        playlists: [mkPlaylist(1)],
        playlistTracksMap: { 1: [mkTrack(1), mkTrack(2)] },
      });
      vi.mocked(ipc.removeTrackFromPlaylist).mockResolvedValue(undefined);
      await usePlaylistStore.getState().removeTrack(1, 1);
      const tracks = usePlaylistStore.getState().playlistTracksMap[1];
      expect(tracks).toHaveLength(1);
      expect(tracks[0].id).toBe(2);
    });
  });
});
