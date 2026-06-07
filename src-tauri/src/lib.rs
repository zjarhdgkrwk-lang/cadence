mod commands;
mod db;
mod logging;
mod media_controls;
mod scan;
mod state;

// output_watcher는 Windows 전용 빌드에서만 컴파일
#[cfg(target_os = "windows")]
mod output_watcher;

use state::{DbState, LogState};
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // 창 위치·크기를 종료 시 저장, 다음 시작 시 복원
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // ── 로깅 초기화 ───────────────────────────────────────────────────
            let log_dir = app.path().app_log_dir().expect("app_log_dir 없음");
            let (log_file_hint, log_guard) = logging::init(&log_dir);
            app.manage(LogState(log_guard));
            tracing::info!(
                log_dir = %log_dir.display(),
                "[Cadence] 로그 위치: {} (일별 롤링, 7일 보관)",
                log_file_hint.display()
            );

            // ── DB 초기화 ─────────────────────────────────────────────────────
            let db_dir = app.path().app_data_dir().expect("app_data_dir 없음");
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
                ensure_tracks_columns(&pool).await;
                pool
            });
            app.manage(DbState(pool));

            // ── SMTC / 미디어 키 초기화 ──────────────────────────────────────
            let window = app
                .get_webview_window("main")
                .expect("main 창이 없음");

            let smtc_state = media_controls::init(app.handle()); // HWND는 init 내부에서 추출
            app.manage(smtc_state);

            // ── 출력 장치 watcher (Windows 전용) ─────────────────────────────
            #[cfg(target_os = "windows")]
            output_watcher::start(app.handle().clone());

            // ── 창 닫기 = 앱 종료 ───────────────────────────────────────────
            // v1 정책: 창 X 버튼 클릭 시 앱을 즉시 종료. 트레이 상주는 v1 비범위.
            // (SSOT §3.9 참조: 트레이 숨김은 사용성 문제로 비범위 이동)
            let app_handle_close = app.handle().clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { .. } = event {
                    tracing::info!("[app] exit on close requested");
                    app_handle_close.exit(0);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::log_frontend,
            commands::open_log_folder,
            media_controls::update_smtc_metadata,
            media_controls::update_smtc_playback,
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
        }
    }
}
