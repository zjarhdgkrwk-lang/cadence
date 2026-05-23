use crate::db::track_repo::{self, PageResult};
use crate::state::DbState;
use tauri::State;

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
