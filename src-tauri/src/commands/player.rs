use crate::db::track_repo::{self, TrackRow};
use crate::state::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

// ── 페이로드 타입 ────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueItemPayload {
    pub position: i64,
    pub track_id: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueueStateSave {
    pub current_index: i64,
    pub shuffle: bool,
    pub repeat_mode: String,
}

#[derive(Debug, Serialize)]
pub struct LoadedQueue {
    pub items: Vec<TrackRow>,
    pub current_index: i64,
    pub shuffle: bool,
    pub repeat_mode: String,
}

// ── 커맨드 ──────────────────────────────────────────────────

/// 큐 전체 저장 (트랜잭션으로 queue_items 교체 + queue_state 갱신)
#[tauri::command]
pub async fn save_queue(
    items: Vec<QueueItemPayload>,
    state_payload: QueueStateSave,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.0;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM queue_items")
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for item in &items {
        sqlx::query(
            "INSERT INTO queue_items (position, track_id, added_at) VALUES (?, ?, ?)",
        )
        .bind(item.position)
        .bind(item.track_id)
        .bind(now_ms())
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    sqlx::query(
        "UPDATE queue_state
         SET current_index=?, shuffle=?, repeat_mode=?, updated_at=?
         WHERE id=1",
    )
    .bind(state_payload.current_index)
    .bind(state_payload.shuffle as i64)
    .bind(&state_payload.repeat_mode)
    .bind(now_ms())
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 큐 + 큐 상태 + 트랙 데이터 전체 로드 (앱 시작 시 복원)
#[tauri::command]
pub async fn load_queue(state: State<'_, DbState>) -> Result<LoadedQueue, String> {
    let pool = &state.0;

    let row: Option<(Option<i64>, i64, String)> = sqlx::query_as(
        "SELECT current_index, shuffle, repeat_mode FROM queue_state WHERE id=1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    let (current_index, shuffle_i, repeat_mode) = match row {
        Some((ci, sh, rm)) => (ci.unwrap_or(-1), sh, rm),
        None => (-1, 0, "no_repeat".to_string()),
    };

    let track_ids: Vec<i64> =
        sqlx::query_scalar("SELECT track_id FROM queue_items ORDER BY position ASC")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

    let mut items = Vec::with_capacity(track_ids.len());
    for tid in track_ids {
        if let Some(track) = track_repo::get_track_by_id(pool, tid)
            .await
            .map_err(|e| e.to_string())?
        {
            items.push(track);
        }
    }

    Ok(LoadedQueue {
        items,
        current_index,
        shuffle: shuffle_i != 0,
        repeat_mode,
    })
}

/// app_state 키-값 단건 조회
#[tauri::command]
pub async fn get_app_state(
    key: String,
    state: State<'_, DbState>,
) -> Result<Option<String>, String> {
    let pool = &state.0;
    let value: Option<String> =
        sqlx::query_scalar("SELECT value FROM app_state WHERE key=?")
            .bind(&key)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
    Ok(value)
}

/// app_state 키-값 단건 저장 (UPSERT)
#[tauri::command]
pub async fn set_app_state(
    key: String,
    value: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.0;
    sqlx::query(
        "INSERT INTO app_state (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .bind(&key)
    .bind(&value)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 재생 통계 갱신: play_count + 1, last_played_at = 지금
/// 50% 또는 30초 이상 재생 시 프런트에서 호출
#[tauri::command]
pub async fn update_play_stats(
    track_id: i64,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.0;
    sqlx::query(
        "UPDATE tracks
         SET play_count = play_count + 1, last_played_at = ?
         WHERE id = ?",
    )
    .bind(now_ms())
    .bind(track_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}
