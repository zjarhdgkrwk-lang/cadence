use sqlx::SqlitePool;

/// SQLite 연결 풀 — scan·commands에서 State<DbState>로 접근
pub struct DbState(pub SqlitePool);

/// 로그 워커 가드 — Drop 시 파일 플러시 중단. 프로세스 종료까지 보관.
pub struct LogState(#[allow(dead_code)] pub crate::logging::LogGuard);
