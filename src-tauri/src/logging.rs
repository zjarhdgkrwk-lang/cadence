use std::path::{Path, PathBuf};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Drop하면 백그라운드 로그 워커가 종료됨 — AppState에 보관해 프로세스 종료까지 유지
pub struct LogGuard(#[allow(dead_code)] WorkerGuard);

/// 파일 + 콘솔 이중 로깅 초기화.
/// log_dir 아래에 cadence.YYYY-MM-DD.log (일별 롤링, 최근 7일 보관).
/// 반환된 LogGuard는 Drop 시 플러시를 멈추므로 AppState에 저장해야 함.
pub fn init(log_dir: &Path) -> (PathBuf, LogGuard) {
    std::fs::create_dir_all(log_dir).expect("로그 디렉터리 생성 실패");

    let file_appender = RollingFileAppender::builder()
        .rotation(Rotation::DAILY)
        .filename_prefix("cadence")
        .filename_suffix("log")
        .max_log_files(7)
        .build(log_dir)
        .expect("파일 어펜더 초기화 실패");

    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let file_layer = fmt::layer()
        .with_ansi(false)
        .with_writer(non_blocking);

    let stdout_layer = fmt::layer()
        .with_writer(std::io::stdout);

    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with(file_layer)
        .with(stdout_layer)
        .init();

    // 오늘 날짜 기반 파일명 (실제 파일명은 appender가 결정)
    let log_file_hint = log_dir.join("cadence.YYYY-MM-DD.log");
    (log_file_hint, LogGuard(guard))
}
