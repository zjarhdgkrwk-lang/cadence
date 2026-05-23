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
  lyrics_source: "lrc_file" | "embedded" | "none";
  missing: boolean;
  date_added: number;
  last_played_at: number | null;
  play_count: number;
}

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
