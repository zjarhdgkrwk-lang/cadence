use sqlx::SqlitePool;

/// SQLite 연결 풀 — scan·commands에서 State<DbState>로 접근
pub struct DbState(pub SqlitePool);

// 향후: PlayerController, LibraryHandle 등 추가
