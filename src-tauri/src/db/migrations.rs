use tauri_plugin_sql::{Migration, MigrationKind};

pub fn all() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: include_str!("../../migrations/001_initial.sql"),
        kind: MigrationKind::Up,
    }]
}
