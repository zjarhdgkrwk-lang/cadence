mod commands;
mod db;
mod scan;
mod state;

use state::DbState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db_dir = app
                .path()
                .app_data_dir()
                .expect("app_data_dir 없음");
            let db_path = db_dir.join("cadence.db");

            std::fs::create_dir_all(&db_dir)
                .expect("app_data_dir 생성 실패");

            println!("[Cadence] DB 경로: {}", db_path.display());

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
                    Ok(()) => println!("[Cadence] 마이그레이션 완료"),
                    Err(e) => panic!("마이그레이션 실패: {e}"),
                }
                pool
            });

            app.manage(DbState(pool));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::scan::add_folder,
            commands::scan::remove_folder,
            commands::scan::list_folders,
            commands::scan::start_scan,
            commands::library::get_tracks,
            commands::library::search_tracks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
