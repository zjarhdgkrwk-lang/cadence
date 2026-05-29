mod commands;
mod db;
mod logging;
mod scan;
mod state;

use state::{DbState, LogState};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // ── 로깅 초기화 (DB보다 먼저) ────────────────────────────
            let log_dir = app
                .path()
                .app_log_dir()
                .expect("app_log_dir 없음");
            let (log_file_hint, log_guard) = logging::init(&log_dir);
            app.manage(LogState(log_guard));

            tracing::info!(
                log_dir = %log_dir.display(),
                "[Cadence] 로그 위치: {} (일별 롤링, 최근 7일 보관)",
                log_file_hint.display()
            );

            // ── DB 초기화 ────────────────────────────────────────────
            let db_dir = app
                .path()
                .app_data_dir()
                .expect("app_data_dir 없음");
            let db_path = db_dir.join("cadence.db");

            std::fs::create_dir_all(&db_dir).expect("app_data_dir 생성 실패");

            tracing::info!(db_path = %db_path.display(), "[db] DB 경로");

            let opts = sqlx::sqlite::SqliteConnectOptions::new()
                .filename(&db_path)
                .create_if_missing(true)
                .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
                .foreign_keys(true);

            let pool = tauri::async_runtime::block_on(async {
                let pool = sqlx::SqlitePool::connect_with(opts)
                    .await
                    .expect("DB 풀 초기화 실패");
                match sqlx::migrate!().run(&pool).await {
                    Ok(()) => tracing::info!("[db] 마이그레이션 완료"),
                    Err(e) => panic!("마이그레이션 실패: {e}"),
                }
                // Phase 3에서 추가됐으나 마이그레이션이 빠진 컬럼 보정.
                // PRAGMA로 존재 여부 확인 후 없을 때만 ALTER — 기존/새 DB 모두 안전.
                ensure_tracks_columns(&pool).await;
                pool
            });

            app.manage(DbState(pool));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::log_frontend,
            commands::open_log_folder,
            commands::scan::add_folder,
            commands::scan::remove_folder,
            commands::scan::list_folders,
            commands::scan::start_scan,
            commands::library::get_tracks,
            commands::library::search_tracks,
            commands::library::search_tracks_v2,
            commands::player::save_queue,
            commands::player::load_queue,
            commands::player::get_app_state,
            commands::player::set_app_state,
            commands::player::update_play_stats,
            commands::playlist::list_playlists,
            commands::playlist::create_playlist,
            commands::playlist::rename_playlist,
            commands::playlist::delete_playlist,
            commands::playlist::get_playlist_tracks,
            commands::playlist::add_tracks_to_playlist,
            commands::playlist::remove_track_from_playlist,
            commands::playlist::reorder_playlist_items,
            commands::playlist::update_lrc_offset,
            commands::playlist::read_lrc_file,
            commands::tag::list_tags,
            commands::tag::create_tag,
            commands::tag::rename_tag,
            commands::tag::set_tag_color,
            commands::tag::delete_tag,
            commands::tag::get_track_tags,
            commands::tag::assign_tags,
            commands::tag::bulk_assign_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Phase 3에서 추가됐으나 Migration 001에서 빠진 chosung 컬럼 보정.
/// PRAGMA table_info로 존재 여부 확인 후 없을 때만 ALTER TABLE 실행.
/// 기존 DB(컬럼 없음)와 새 DB(동일하게 없음) 모두 안전하게 처리한다.
async fn ensure_tracks_columns(pool: &sqlx::SqlitePool) {
    let rows = match sqlx::query("PRAGMA table_info(tracks)")
        .fetch_all(pool)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("[db] PRAGMA table_info(tracks) 실패: {e}");
            return;
        }
    };

    use sqlx::Row;
    let existing: std::collections::HashSet<String> = rows
        .iter()
        .filter_map(|r| r.try_get::<String, _>("name").ok())
        .collect();

    for col in &["chosung_title", "chosung_artist"] {
        if !existing.contains(*col) {
            let sql = format!("ALTER TABLE tracks ADD COLUMN {col} TEXT");
            match sqlx::query(&sql).execute(pool).await {
                Ok(_) => tracing::info!("[db] tracks.{col} 컬럼 추가"),
                Err(e) => tracing::error!("[db] tracks.{col} 추가 실패: {e}"),
            }
        } else {
            tracing::debug!("[db] tracks.{col} 이미 존재 — 스킵");
        }
    }
}
