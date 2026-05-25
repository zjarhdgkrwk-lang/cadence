export interface Track {
  id: number;
  path: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  album_artist: string | null;
  genre: string | null;
  track_no: number | null;
  disc_no: number | null;
  year: number | null;
  duration_ms: number | null;
  bitrate: number | null;
  codec: string | null;
  has_embedded_art: boolean;
  art_cache_path: string | null;
  dominant_color: string | null;
  lrc_path: string | null;
  lrc_offset_ms: number;
  lyrics_source: "lrc_file" | "embedded" | "none";
  missing: boolean;
  date_added: number;
  last_played_at: number | null;
  play_count: number;
  replaygain_track_gain: number | null;
  replaygain_album_gain: number | null;
}

export type ReplaygainMode = "off" | "track" | "album";

export interface Playlist {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface LrcLine {
  timeMs: number;
  text: string;
}

export type QueueSource =
  | { type: "library" }
  | { type: "playlist"; playlistId: number; playlistName: string };

export interface FolderEntry {
  id: number;
  path: string;
  recursive: boolean;
  added_at: number;
}

export interface ScanProgress {
  scanned: number;
  total: number;
  current_file: string;
}

export interface ScanComplete {
  inserted: number;
  updated: number;
  errors: number;
}

export interface PageResult {
  tracks: Track[];
  total: number;
}

export type SortField =
  | "artist"
  | "title"
  | "album"
  | "date_added"
  | "play_count"
  | "last_played";

export type SortDir = "asc" | "desc";

// ── Player ─────────────────────────────────────────────────────
export type RepeatMode =
  | "no_repeat"    // 반복 없이 전체 재생
  | "repeat_all"   // 큐 전체 반복
  | "repeat_one"   // 한 곡 반복
  | "one_track";   // 한 곡만 재생 후 정지

export type PlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "seeking"
  | "buffering"
  | "ended"
  | "error";

// ── Queue IPC payloads ─────────────────────────────────────────
export interface QueueItemPayload {
  position: number;
  track_id: number;
}

export interface SaveQueuePayload {
  items: QueueItemPayload[];
  current_index: number;
  shuffle: boolean;
  repeat_mode: RepeatMode;
}

export interface LoadedQueue {
  items: Track[];
  current_index: number;
  shuffle: boolean;
  repeat_mode: RepeatMode;
}
