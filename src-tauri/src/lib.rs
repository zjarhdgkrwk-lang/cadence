mod commands;
mod db;
mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:cadence.db", db::migrations::all())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![commands::app_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
