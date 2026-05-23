pub mod track_repo;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct FolderEntry {
    pub id: i64,
    pub path: String,
    pub recursive: bool,
    pub added_at: i64,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub async fn add_folder(pool: &SqlitePool, path: &str, recursive: bool) -> Result<FolderEntry> {
    let now = now_ms();
    let row: (i64,) =
        sqlx::query_as("INSERT INTO folders (path, recursive, added_at) VALUES (?,?,?) RETURNING id")
            .bind(path)
            .bind(recursive as i64)
            .bind(now)
            .fetch_one(pool)
            .await?;

    Ok(FolderEntry {
        id: row.0,
        path: path.to_string(),
        recursive,
        added_at: now,
    })
}

pub async fn remove_folder(pool: &SqlitePool, folder_id: i64) -> Result<()> {
    sqlx::query("DELETE FROM folders WHERE id=?")
        .bind(folder_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_folders(pool: &SqlitePool) -> Result<Vec<FolderEntry>> {
    let rows: Vec<FolderEntry> =
        sqlx::query_as("SELECT id, path, recursive, added_at FROM folders ORDER BY added_at")
            .fetch_all(pool)
            .await?;
    Ok(rows)
}
