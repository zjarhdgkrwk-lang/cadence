import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  FolderEntry,
  LoadedQueue,
  PageResult,
  SaveQueuePayload,
  ScanComplete,
  ScanProgress,
  SortDir,
  SortField,
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
