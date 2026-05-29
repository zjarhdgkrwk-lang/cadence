use crate::state::DbState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TagRow {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
}

// ── 태그 CRUD ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_tags(state: State<'_, DbState>) -> Result<Vec<TagRow>, String> {
    let pool = &state.0;
    sqlx::query_as("SELECT id, name, color FROM tags ORDER BY name ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_tag(
    name: String,
    color: Option<String>,
    state: State<'_, DbState>,
) -> Result<TagRow, String> {
    let pool = &state.0;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO tags (name, color) VALUES (?, ?) RETURNING id",
    )
    .bind(&name)
    .bind(&color)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    tracing::info!("[tag] 생성: id={id} name={name}");
    Ok(TagRow { id, name, color })
}

#[tauri::command]
pub async fn rename_tag(
    id: i64,
    name: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.0;
    sqlx::query("UPDATE tags SET name=? WHERE id=?")
        .bind(&name)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    tracing::info!("[tag] 이름변경: id={id} name={name}");
    Ok(())
}

#[tauri::command]
pub async fn set_tag_color(
    id: i64,
    color: Option<String>,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.0;
    sqlx::query("UPDATE tags SET color=? WHERE id=?")
        .bind(&color)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    tracing::info!("[tag] 색상 변경: id={id} color={color:?}");
    Ok(())
}

#[tauri::command]
pub async fn delete_tag(id: i64, state: State<'_, DbState>) -> Result<(), String> {
    let pool = &state.0;
    sqlx::query("DELETE FROM tags WHERE id=?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    tracing::info!("[tag] 삭제: id={id}");
    Ok(())
}

#[tauri::command]
pub async fn get_track_tags(
    track_id: i64,
    state: State<'_, DbState>,
) -> Result<Vec<TagRow>, String> {
    let pool = &state.0;
    sqlx::query_as(
        "SELECT t.id, t.name, t.color FROM tags t
         JOIN track_tags tt ON tt.tag_id = t.id
         WHERE tt.track_id = ?
         ORDER BY t.name ASC",
    )
    .bind(track_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())
}

// ── FTS 동기화 헬퍼 ──────────────────────────────────────────────────────────

/// track_tags 변경 전 old_tags 문자열을 이용해 FTS 인덱스를 갱신한다.
/// 트랜잭션 커밋 후 호출해야 new_tags 서브쿼리가 정확한 값을 반환한다.
async fn sync_track_fts(
    pool: &sqlx::SqlitePool,
    track_id: i64,
    old_tags: &str,
) -> Result<(), sqlx::Error> {
    let meta: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT COALESCE(raw_title,''), COALESCE(raw_artist,''),
                COALESCE(raw_album,''), COALESCE(raw_album_artist,'')
         FROM tracks WHERE id=?",
    )
    .bind(track_id)
    .fetch_optional(pool)
    .await?;

    let Some((title, artist, album, album_artist)) = meta else {
        tracing::warn!("[tag] sync_track_fts: track_id={track_id} not found — skip");
        return Ok(());
    };

    let new_tags: String = sqlx::query_scalar(
        "SELECT COALESCE(GROUP_CONCAT(t.name, ' '), '')
         FROM tags t JOIN track_tags tt ON tt.tag_id = t.id
         WHERE tt.track_id = ?",
    )
    .bind(track_id)
    .fetch_one(pool)
    .await?;

    sqlx::query(
        "INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, album_artist, tags)
         VALUES ('delete', ?, ?, ?, ?, ?, ?)",
    )
    .bind(track_id)
    .bind(&title).bind(&artist).bind(&album).bind(&album_artist)
    .bind(old_tags)
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO tracks_fts(rowid, title, artist, album, album_artist, tags)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(track_id)
    .bind(&title).bind(&artist).bind(&album).bind(&album_artist)
    .bind(&new_tags)
    .execute(pool)
    .await?;

    tracing::debug!("[tag] FTS 동기화: track_id={track_id} tags='{new_tags}'");
    Ok(())
}

// ── 태그 배정 ─────────────────────────────────────────────────────────────────

/// 곡의 태그를 완전히 교체(SET). tag_ids가 비어 있으면 전체 해제.
#[tauri::command]
pub async fn assign_tags(
    track_id: i64,
    tag_ids: Vec<i64>,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.0;

    let old_tags: String = sqlx::query_scalar(
        "SELECT COALESCE(GROUP_CONCAT(t.name, ' '), '')
         FROM tags t JOIN track_tags tt ON tt.tag_id = t.id
         WHERE tt.track_id = ?",
    )
    .bind(track_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM track_tags WHERE track_id=?")
        .bind(track_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    for &tag_id in &tag_ids {
        sqlx::query(
            "INSERT OR IGNORE INTO track_tags (track_id, tag_id) VALUES (?, ?)",
        )
        .bind(track_id)
        .bind(tag_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    sync_track_fts(pool, track_id, &old_tags)
        .await
        .map_err(|e| e.to_string())?;

    tracing::info!("[tag] assign: track_id={track_id} tag_ids={tag_ids:?}");
    Ok(())
}

/// 여러 곡에 태그를 일괄 추가(ADD — 기존 태그 유지).
#[tauri::command]
pub async fn bulk_assign_tags(
    track_ids: Vec<i64>,
    tag_ids: Vec<i64>,
    state: State<'_, DbState>,
) -> Result<(), String> {
    if track_ids.is_empty() || tag_ids.is_empty() {
        return Ok(());
    }
    let pool = &state.0;

    for &track_id in &track_ids {
        let old_tags: String = sqlx::query_scalar(
            "SELECT COALESCE(GROUP_CONCAT(t.name, ' '), '')
             FROM tags t JOIN track_tags tt ON tt.tag_id = t.id
             WHERE tt.track_id = ?",
        )
        .bind(track_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

        let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
        for &tag_id in &tag_ids {
            sqlx::query(
                "INSERT OR IGNORE INTO track_tags (track_id, tag_id) VALUES (?, ?)",
            )
            .bind(track_id)
            .bind(tag_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
        tx.commit().await.map_err(|e| e.to_string())?;

        sync_track_fts(pool, track_id, &old_tags)
            .await
            .map_err(|e| e.to_string())?;
    }

    tracing::info!(
        "[tag] bulk_assign: track_count={} tag_ids={tag_ids:?}",
        track_ids.len()
    );
    Ok(())
}
