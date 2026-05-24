use crate::db::{self, FolderEntry};
use crate::scan;
use crate::state::DbState;
use tauri::{AppHandle, State};

fn map_err(e: anyhow::Error) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn add_folder(
    path: String,
    recursive: Option<bool>,
    state: State<'_, DbState>,
) -> Result<FolderEntry, String> {
    db::add_folder(&state.0, &path, recursive.unwrap_or(true))
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn remove_folder(
    folder_id: i64,
    state: State<'_, DbState>,
) -> Result<(), String> {
    db::remove_folder(&state.0, folder_id).await.map_err(map_err)
}

#[tauri::command]
pub async fn list_folders(state: State<'_, DbState>) -> Result<Vec<FolderEntry>, String> {
    db::list_folders(&state.0).await.map_err(map_err)
}

/// 백그라운드 스캔 시작. 진행 상황은 scan:progress / scan:complete 이벤트로 전달.
#[tauri::command]
pub async fn start_scan(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let folders = db::list_folders(&state.0).await.map_err(map_err)?;

    let scan_folders: Vec<(i64, std::path::PathBuf, bool)> = folders
        .into_iter()
        .map(|f| (f.id, std::path::PathBuf::from(&f.path), f.recursive))
        .collect();

    tracing::info!("[scan] 스캔 시작  폴더 수={}", scan_folders.len());
    let app_clone = app.clone();
    tokio::spawn(async move {
        if let Err(e) = scan::scan_folders(app_clone, scan_folders).await {
            tracing::error!("[scan] 스캔 태스크 오류: {e}");
        }
    });

    Ok(())
}
