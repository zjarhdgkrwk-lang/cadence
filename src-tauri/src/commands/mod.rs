pub mod library;
pub mod player;
pub mod playlist;
pub mod scan;

use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub db_path: String,
    pub log_dir: String,
}

#[tauri::command]
pub fn app_info(app: tauri::AppHandle) -> AppInfo {
    let version = app.package_info().version.to_string();
    let db_path = app
        .path()
        .app_data_dir()
        .map(|p| p.join("cadence.db").to_string_lossy().into_owned())
        .unwrap_or_else(|_| "<unknown>".into());
    let log_dir = app
        .path()
        .app_log_dir()
        .map(|p| p.join("logs").to_string_lossy().into_owned())
        .unwrap_or_else(|_| "<unknown>".into());
    AppInfo { version, db_path, log_dir }
}

/// 프런트엔드 로그를 Rust tracing으로 전달. [FE] 태그로 기록됨.
#[tauri::command]
pub fn log_frontend(level: String, msg: String, source: Option<String>) {
    let src = source.as_deref().unwrap_or("");
    match level.as_str() {
        "error" => tracing::error!("[FE] {msg}  source={src}"),
        "warn" => tracing::warn!("[FE] {msg}  source={src}"),
        "info" | "log" => tracing::info!("[FE] {msg}  source={src}"),
        _ => tracing::debug!("[FE] {msg}  source={src}"),
    }
}

/// 로그 폴더를 파일 탐색기로 엶 (Windows only).
#[tauri::command]
pub fn open_log_folder(app: tauri::AppHandle) -> Result<(), String> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map(|p| p.join("logs"))
        .map_err(|e| e.to_string())?;

    tracing::info!("[Cadence] 로그 폴더 열기 요청: {}", log_dir.display());

    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(&log_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        tracing::warn!("[Cadence] open_log_folder: Windows 전용 기능 (현재 환경 비활성)");
    }

    Ok(())
}
