import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  FolderEntry,
  LoadedQueue,
  PageResult,
  PlaylistItemOrder,
  Playlist,
  SaveQueuePayload,
  ScanComplete,
  ScanProgress,
  SearchField,
  SortDir,
  SortField,
  Tag,
  TagFilterMode,
  Track,
} from "./types";

export interface AppInfo {
  version: string;
  db_path: string;
  log_dir: string;
}

export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info");
}

// ── 로깅 ──────────────────────────────────────────────────────

export type LogLevel = "log" | "info" | "warn" | "error";

/** 프런트엔드 로그를 Rust tracing으로 전달 (fire-and-forget) */
export function logFrontend(level: LogLevel, msg: string, source?: string): void {
  invoke<void>("log_frontend", { level, msg, source: source ?? "" }).catch(() => {});
}

/** 로그 폴더를 파일 탐색기로 열기 */
export async function openLogFolder(): Promise<void> {
  return invoke<void>("open_log_folder");
}

// ── 폴더 관리 ─────────────────────────────────────────────────

export async function addFolder(
  path: string,
  recursive = true
): Promise<FolderEntry> {
  return invoke<FolderEntry>("add_folder", { path, recursive });
}

export async function removeFolder(folderId: number): Promise<void> {
  return invoke<void>("remove_folder", { folderId });
}

export async function listFolders(): Promise<FolderEntry[]> {
  return invoke<FolderEntry[]>("list_folders");
}

// ── 스캔 ──────────────────────────────────────────────────────

export async function startScan(): Promise<void> {
  return invoke<void>("start_scan");
}

export function onScanProgress(cb: (p: ScanProgress) => void) {
  return listen<ScanProgress>("scan:progress", (e) => cb(e.payload));
}

export function onScanComplete(cb: (r: ScanComplete) => void) {
  return listen<ScanComplete>("scan:complete", (e) => cb(e.payload));
}

// ── 라이브러리 쿼리 ───────────────────────────────────────────

export async function getTracks(params: {
  sortField?: SortField;
  sortDir?: SortDir;
  offset?: number;
  limit?: number;
}): Promise<PageResult> {
  return invoke<PageResult>("get_tracks", {
    sortField: params.sortField ?? "artist",
    sortDir: params.sortDir ?? "asc",
    offset: params.offset ?? 0,
    limit: params.limit ?? 100,
  });
}

export async function searchTracks(
  query: string,
  offset = 0,
  limit = 100
): Promise<PageResult> {
  return invoke<PageResult>("search_tracks", { query, offset, limit });
}

// ── アート サムネイル URL ────────────────────────────────────

// ── 플레이어 영속 ──────────────────────────────────────────────

export async function saveQueue(payload: SaveQueuePayload): Promise<void> {
  return invoke<void>("save_queue", {
    items: payload.items,
    statePayload: {
      current_index: payload.current_index,
      shuffle: payload.shuffle,
      repeat_mode: payload.repeat_mode,
    },
  });
}

export async function loadQueue(): Promise<LoadedQueue> {
  return invoke<LoadedQueue>("load_queue");
}

export async function getAppState(key: string): Promise<string | null> {
  return invoke<string | null>("get_app_state", { key });
}

export async function setAppState(key: string, value: string): Promise<void> {
  return invoke<void>("set_app_state", { key, value });
}

export async function updatePlayStats(trackId: number): Promise<void> {
  return invoke<void>("update_play_stats", { trackId });
}

// ── LRC 가사 ──────────────────────────────────────────────────

export async function readLrcFile(trackId: number): Promise<string | null> {
  return invoke<string | null>("read_lrc_file", { trackId });
}

export async function updateLrcOffset(trackId: number, offsetMs: number): Promise<void> {
  return invoke<void>("update_lrc_offset", { trackId, offsetMs });
}

// ── 플레이리스트 ───────────────────────────────────────────────

export async function listPlaylists(): Promise<Playlist[]> {
  return invoke<Playlist[]>("list_playlists");
}

export async function createPlaylist(name: string): Promise<Playlist> {
  return invoke<Playlist>("create_playlist", { name });
}

export async function renamePlaylist(id: number, name: string): Promise<void> {
  return invoke<void>("rename_playlist", { id, name });
}

export async function deletePlaylist(id: number): Promise<void> {
  return invoke<void>("delete_playlist", { id });
}

export async function getPlaylistTracks(playlistId: number): Promise<Track[]> {
  return invoke<Track[]>("get_playlist_tracks", { playlistId });
}

export async function addTracksToPlaylist(playlistId: number, trackIds: number[]): Promise<void> {
  return invoke<void>("add_tracks_to_playlist", { playlistId, trackIds });
}

export async function removeTrackFromPlaylist(playlistId: number, trackId: number): Promise<void> {
  return invoke<void>("remove_track_from_playlist", { playlistId, trackId });
}

export async function reorderPlaylistItems(
  playlistId: number,
  newOrder: PlaylistItemOrder[],
): Promise<void> {
  return invoke<void>("reorder_playlist_items", { playlistId, newOrder });
}

// ── 태그 ──────────────────────────────────────────────────────────────────────

export async function listTags(): Promise<Tag[]> {
  return invoke<Tag[]>("list_tags");
}

export async function createTag(name: string, color?: string | null): Promise<Tag> {
  return invoke<Tag>("create_tag", { name, color: color ?? null });
}

export async function renameTag(id: number, name: string): Promise<void> {
  return invoke<void>("rename_tag", { id, name });
}

export async function setTagColor(id: number, color: string | null): Promise<void> {
  return invoke<void>("set_tag_color", { id, color });
}

export async function deleteTag(id: number): Promise<void> {
  return invoke<void>("delete_tag", { id });
}

export async function getTrackTags(trackId: number): Promise<Tag[]> {
  return invoke<Tag[]>("get_track_tags", { trackId });
}

export async function assignTags(trackId: number, tagIds: number[]): Promise<void> {
  return invoke<void>("assign_tags", { trackId, tagIds });
}

export async function bulkAssignTags(trackIds: number[], tagIds: number[]): Promise<void> {
  return invoke<void>("bulk_assign_tags", { trackIds, tagIds });
}

// ── 검색 v2 ───────────────────────────────────────────────────────────────────

export async function searchTracksV2(params: {
  query?: string;
  fields?: SearchField[];
  tagIds?: number[];
  tagMode?: TagFilterMode;
  offset?: number;
  limit?: number;
}): Promise<PageResult> {
  return invoke<PageResult>("search_tracks_v2", {
    query: params.query ?? null,
    fields: params.fields ?? null,
    tagIds: params.tagIds ?? null,
    tagMode: params.tagMode ?? null,
    offset: params.offset ?? 0,
    limit: params.limit ?? 200,
  });
}

// ── SMTC (System Media Transport Controls) ───────────────────────────────────

export interface SmtcMetadataPayload {
  title: string;
  artist: string;
  album: string;
  artPath: string | null;
  durationMs: number | null;
}

/** SMTC 메타데이터 갱신 (트랙 변경 시 즉시 호출) */
export async function updateSmtcMetadata(p: SmtcMetadataPayload): Promise<void> {
  // Tauri IPC: Rust Option<u64>는 JS number(null-safe integer range)로 직렬화.
  // BigInt 사용 시 Tauri IPC 직렬화 실패로 조용히 무시되므로 사용 금지.
  return invoke<void>("update_smtc_metadata", {
    title: p.title,
    artist: p.artist,
    album: p.album,
    artPath: p.artPath,
    durationMs: p.durationMs != null ? Math.round(p.durationMs) : null,
  });
}

/** SMTC 재생 상태 갱신 (상태 변경 즉시, 위치는 ~1초 스로틀) */
export async function updateSmtcPlayback(p: {
  status: "playing" | "paused" | "stopped";
  positionMs: number | null;
}): Promise<void> {
  return invoke<void>("update_smtc_playback", {
    status: p.status,
    positionMs: p.positionMs != null ? Math.round(p.positionMs) : null,
  });
}

// ── アート サムネイル URL ────────────────────────────────────
let _artUrlLoggedOnce = false;

/** art_cache_path(절대경로) → asset 프로토콜 URL (convertFileSrc 사용) */
export function artUrl(artCachePath: string | null): string | null {
  if (!artCachePath) return null;
  const url = convertFileSrc(artCachePath);
  // [진단] 최초 변환 결과 한 번만 출력 — URL 형식 확인용
  if (!_artUrlLoggedOnce) {
    console.log("[artUrl] 첫 번째 변환:", artCachePath, "→", url);
    _artUrlLoggedOnce = true;
  }
  return url;
}
