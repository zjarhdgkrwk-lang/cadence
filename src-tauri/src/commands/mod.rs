pub mod library;
pub mod scan;

use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub db_path: String,
}

#[tauri::command]
pub fn app_info(app: tauri::AppHandle) -> AppInfo {
    let version = app.package_info().version.to_string();
    let db_path = app
        .path()
        .app_data_dir()
        .map(|p| p.join("cadence.db").to_string_lossy().into_owned())
        .unwrap_or_else(|_| "<unknown>".into());
    AppInfo { version, db_path }
}
