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
                .expect("app_log_dir 없음")
                .join("logs");
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
            commands::player::save_queue,
            commands::player::load_queue,
            commands::player::get_app_state,
            commands::player::set_app_state,
            commands::player::update_play_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
