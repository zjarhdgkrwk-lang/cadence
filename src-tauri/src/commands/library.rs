use crate::db::track_repo::{self, PageResult};
use crate::state::DbState;
use tauri::State;

// ── 기본 get_tracks / search_tracks (하위 호환 유지) ─────────────────────────

fn map_err(e: anyhow::Error) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn get_tracks(
    sort_field: Option<String>,
    sort_dir: Option<String>,
    offset: Option<i64>,
    limit: Option<i64>,
    state: State<'_, DbState>,
) -> Result<PageResult, String> {
    track_repo::get_tracks(
        &state.0,
        sort_field.as_deref().unwrap_or("artist"),
        sort_dir.as_deref().unwrap_or("asc"),
        offset.unwrap_or(0),
        limit.unwrap_or(100),
    )
    .await
    .map_err(map_err)
}

#[tauri::command]
pub async fn search_tracks(
    query: String,
    offset: Option<i64>,
    limit: Option<i64>,
    state: State<'_, DbState>,
) -> Result<PageResult, String> {
    if query.trim().is_empty() {
        return Ok(PageResult { tracks: vec![], total: 0 });
    }
    track_repo::search_tracks(
        &state.0,
        query.trim(),
        offset.unwrap_or(0),
        limit.unwrap_or(100),
    )
    .await
    .map_err(map_err)
}

// ── search_tracks_v2: 필드 필터 + 태그 AND/OR 필터 ──────────────────────────

#[tauri::command]
pub async fn search_tracks_v2(
    query: Option<String>,
    fields: Option<Vec<String>>,
    tag_ids: Option<Vec<i64>>,
    tag_mode: Option<String>,
    offset: Option<i64>,
    limit: Option<i64>,
    state: State<'_, DbState>,
) -> Result<PageResult, String> {
    let default_fields = vec![
        "title".to_string(),
        "artist".to_string(),
        "album".to_string(),
        "tags".to_string(),
    ];
    track_repo::search_tracks_v2(
        &state.0,
        query.as_deref().unwrap_or(""),
        &fields.unwrap_or(default_fields),
        &tag_ids.unwrap_or_default(),
        tag_mode.as_deref().unwrap_or("or"),
        offset.unwrap_or(0),
        limit.unwrap_or(100),
    )
    .await
    .map_err(map_err)
}
