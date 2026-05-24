use crate::db::track_repo::TrackRow;
use crate::state::DbState;
use lofty::{file::TaggedFileExt, read_from_path};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct PlaylistRow {
    pub id: i64,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

// ── 플레이리스트 CRUD ─────────────────────────────────────────────

#[tauri::command]
pub async fn list_playlists(state: State<'_, DbState>) -> Result<Vec<PlaylistRow>, String> {
    let pool = &state.0;
    sqlx::query_as("SELECT id, name, created_at, updated_at FROM playlists ORDER BY name ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_playlist(
    name: String,
    state: State<'_, DbState>,
) -> Result<PlaylistRow, String> {
    let pool = &state.0;
    let now = now_ms();
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO playlists (name, created_at, updated_at) VALUES (?, ?, ?) RETURNING id",
    )
    .bind(&name)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    tracing::info!("[playlist] 생성: id={id} name={name}");
    Ok(PlaylistRow { id, name, created_at: now, updated_at: now })
}

#[tauri::command]
pub async fn rename_playlist(
    id: i64,
    name: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.0;
    let now = now_ms();
    sqlx::query("UPDATE playlists SET name=?, updated_at=? WHERE id=?")
        .bind(&name)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    tracing::info!("[playlist] 이름변경: id={id} name={name}");
    Ok(())
}

#[tauri::command]
pub async fn delete_playlist(id: i64, state: State<'_, DbState>) -> Result<(), String> {
    let pool = &state.0;
    sqlx::query("DELETE FROM playlists WHERE id=?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    tracing::info!("[playlist] 삭제: id={id}");
    Ok(())
}

// ── 플레이리스트 아이템 ──────────────────────────────────────────

const PLAYLIST_TRACK_SQL: &str = "
SELECT t.id, t.path, t.filename,
  COALESCE(t.title_override, t.raw_title, t.filename) AS title,
  COALESCE(t.artist_override, t.raw_artist, '') AS artist,
  COALESCE(t.album_override, t.raw_album, '') AS album,
  COALESCE(t.album_artist_override, t.raw_album_artist) AS album_artist,
  COALESCE(t.genre_override, t.raw_genre) AS genre,
  COALESCE(t.track_no_override, t.raw_track_no) AS track_no,
  COALESCE(t.disc_no_override, t.raw_disc_no) AS disc_no,
  COALESCE(t.year_override, t.raw_year) AS year,
  t.duration_ms, t.bitrate, t.codec,
  t.has_embedded_art, t.art_cache_path, t.dominant_color,
  t.lrc_path, t.lrc_offset_ms,
  t.lyrics_source, t.missing, t.date_added, t.last_played_at, t.play_count
FROM tracks t
JOIN playlist_items pi ON pi.track_id = t.id
WHERE pi.playlist_id = ? AND t.missing = 0
ORDER BY pi.position ASC
";

#[tauri::command]
pub async fn get_playlist_tracks(
    playlist_id: i64,
    state: State<'_, DbState>,
) -> Result<Vec<TrackRow>, String> {
    let pool = &state.0;
    sqlx::query_as(PLAYLIST_TRACK_SQL)
        .bind(playlist_id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_tracks_to_playlist(
    playlist_id: i64,
    track_ids: Vec<i64>,
    state: State<'_, DbState>,
) -> Result<(), String> {
    if track_ids.is_empty() {
        return Ok(());
    }
    let pool = &state.0;

    let max_pos: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(position), -1) FROM playlist_items WHERE playlist_id=?",
    )
    .bind(playlist_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    for (i, track_id) in track_ids.iter().enumerate() {
        sqlx::query(
            "INSERT INTO playlist_items (playlist_id, track_id, position) VALUES (?, ?, ?)",
        )
        .bind(playlist_id)
        .bind(track_id)
        .bind(max_pos + 1 + i as i64)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;

    sqlx::query("UPDATE playlists SET updated_at=? WHERE id=?")
        .bind(now_ms())
        .bind(playlist_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    tracing::info!(
        "[playlist] 곡 추가: playlist_id={playlist_id} count={}",
        track_ids.len()
    );
    Ok(())
}

#[tauri::command]
pub async fn remove_track_from_playlist(
    playlist_id: i64,
    track_id: i64,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.0;
    // position 오름차순 첫 번째 항목 삭제 (중복 허용 스키마에서 첫 번째 제거)
    sqlx::query(
        "DELETE FROM playlist_items WHERE id = (
           SELECT id FROM playlist_items
           WHERE playlist_id=? AND track_id=?
           ORDER BY position ASC LIMIT 1
         )",
    )
    .bind(playlist_id)
    .bind(track_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE playlists SET updated_at=? WHERE id=?")
        .bind(now_ms())
        .bind(playlist_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    tracing::info!("[playlist] 곡 제거: playlist_id={playlist_id} track_id={track_id}");
    Ok(())
}

// ── LRC 가사 ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_lrc_offset(
    track_id: i64,
    offset_ms: i64,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.0;
    sqlx::query("UPDATE tracks SET lrc_offset_ms=? WHERE id=?")
        .bind(offset_ms)
        .bind(track_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    tracing::info!("[lrc] 오프셋 저장: track_id={track_id} offset_ms={offset_ms}");
    Ok(())
}

#[tauri::command]
pub async fn read_lrc_file(
    track_id: i64,
    state: State<'_, DbState>,
) -> Result<Option<String>, String> {
    let pool = &state.0;

    let row: Option<(Option<String>, String, String)> =
        sqlx::query_as("SELECT lrc_path, lyrics_source, path FROM tracks WHERE id=?")
            .bind(track_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;

    let (lrc_path, lyrics_source, track_path) = match row {
        Some(r) => r,
        None => {
            tracing::warn!("[lrc] track_id={track_id} not found");
            return Ok(None);
        }
    };

    match lyrics_source.as_str() {
        "lrc_file" => {
            let path = lrc_path.unwrap_or_default();
            match std::fs::read_to_string(&path) {
                Ok(content) => {
                    tracing::info!("[lrc] matched  track_id={track_id}  path={path}");
                    Ok(Some(content))
                }
                Err(e) => {
                    tracing::warn!(
                        "[lrc] lrc_file 읽기 실패  track_id={track_id}  path={path}  err={e}"
                    );
                    Ok(None)
                }
            }
        }
        "embedded" => match read_embedded_lyrics(&track_path) {
            Some(lyrics) => {
                tracing::info!("[lrc] embedded fallback  track_id={track_id}");
                Ok(Some(lyrics))
            }
            None => {
                tracing::warn!("[lrc] embedded 가사 없음  track_id={track_id}");
                Ok(None)
            }
        },
        _ => {
            tracing::debug!("[lrc] none  track_id={track_id}");
            Ok(None)
        }
    }
}

fn read_embedded_lyrics(path: &str) -> Option<String> {
    let tagged = read_from_path(Path::new(path)).ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    tag.get_string(&lofty::tag::ItemKey::Lyrics)
        .map(|s| s.to_string())
}
