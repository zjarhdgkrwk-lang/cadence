//! souvlaki SMTC 연동 + 미디어 키 이벤트 라우팅 (souvlaki 0.7.3 API 기준)
//!
//! souvlaki 0.7.3 주요 API:
//!   - `PlatformConfig { dbus_name, display_name, hwnd }` (통합 구조체, 전 플랫폼 공통)
//!   - `MediaControls::new(config)` → `Result<MediaControls, Error>`
//!   - `controls.attach(handler)` → 이벤트 리스너 등록
//!   - `controls.set_metadata(&meta)`, `controls.set_playback(state)`
//!
//! Windows에서 `hwnd` 필수. WinRT SMTC는 hwnd 없이는 초기화 안 됨.
//! HWND는 AppHandle + raw_window_handle 트레이트로 추출.

use crate::state::MediaControlsState;
use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

// ── 초기화 ───────────────────────────────────────────────────────────────────

/// souvlaki 초기화. 성공/실패 모두 MediaControlsState를 반환(실패 시 None).
///
/// hwnd는 Windows에서 필수 (WinRT SMTC가 창 핸들 필요).
/// Linux CI에서는 D-Bus MPRIS 백엔드로 컴파일됨(실제 실행 없음).
pub fn init(app: &AppHandle) -> MediaControlsState {
    // souvlaki 0.7.3: PlatformConfig는 통합 구조체 — 전 플랫폼이 모든 필드 지정
    let platform_config = souvlaki::PlatformConfig {
        dbus_name: "com.cadence.app",
        display_name: "Cadence",
        #[cfg(target_os = "windows")]
        hwnd: get_hwnd(app),
        #[cfg(not(target_os = "windows"))]
        hwnd: None,
    };

    let controls = match MediaControls::new(platform_config) {
        Ok(mut c) => {
            let app_handle = app.clone();
            // Play / Pause / Toggle, Next, Previous, Stop — 모두 등록해야 버튼이 활성화됨
            if let Err(e) = c.attach(move |event: MediaControlEvent| {
                let action = match event {
                    MediaControlEvent::Play
                    | MediaControlEvent::Pause
                    | MediaControlEvent::Toggle => "play_pause",
                    MediaControlEvent::Next => "next",
                    MediaControlEvent::Previous => "prev",
                    MediaControlEvent::Stop => "stop",
                    _ => return,
                };
                tracing::info!("[media_key] action={action}  source=smtc_callback");
                app_handle.emit("media_key_event", action).ok();
            }) {
                tracing::warn!("[smtc] attach 실패: {e:?}");
            } else {
                // 핸들러가 등록되어야 SMTC 이전/다음 버튼이 활성화됨
                tracing::info!("[smtc] handlers registered: play_pause/next/prev/stop");
            }
            tracing::info!("[smtc] initialized ok  display_name=Cadence");
            Some(c)
        }
        Err(e) => {
            tracing::error!("[smtc] init 실패: {e:?}");
            None
        }
    };

    MediaControlsState(Arc::new(Mutex::new(controls)))
}

/// Windows에서 메인 창의 HWND를 raw_window_handle 트레이트로 추출.
#[cfg(target_os = "windows")]
fn get_hwnd(app: &AppHandle) -> Option<*mut std::ffi::c_void> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use tauri::Manager;
    let window = app.get_webview_window("main")?;
    window.window_handle().ok().and_then(|h| match h.as_raw() {
        RawWindowHandle::Win32(w) => Some(w.hwnd.get() as usize as *mut std::ffi::c_void),
        _ => None,
    })
}

// ── IPC 커맨드 ───────────────────────────────────────────────────────────────

/// FE가 트랙 변경 시 호출. SMTC 메타데이터 갱신.
///
/// 앨범아트 전달 전략 (Windows WinRT 한계 대응):
///   WinRT의 RandomAccessStreamReference::CreateFromUri는 file:// 스킴을 지원하지
///   않아 HRESULT 0x800700A1(ERROR_BAD_PATHNAME)이 반환된다. 이로 인해 title/artist
///   까지 통째로 실패한다. 따라서 두 단계로 처리한다:
///   1) cover_url 포함 시도 → 성공이면 OK
///   2) 실패 시 cover_url = None으로 재시도 → title/artist/album은 반드시 반영
#[tauri::command]
pub fn update_smtc_metadata(
    state: State<'_, MediaControlsState>,
    title: String,
    artist: String,
    album: String,
    art_path: Option<String>,
    duration_ms: Option<u64>,
) -> Result<(), String> {
    let art_uri = art_path.as_deref().map(path_to_file_uri);

    // cover_url로 사용될 최종 URI를 한 번 로그 — 다음 진단 시 형식 확인용
    if let Some(ref uri) = art_uri {
        tracing::info!("[smtc] cover_url final=\"{uri}\"");
    }

    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(controls) = guard.as_mut() {
        let dur = duration_ms.map(Duration::from_millis);

        // ── 1단계: cover_url 포함 ──────────────────────────────────────────
        let meta = MediaMetadata {
            title: Some(title.as_str()),
            artist: Some(artist.as_str()),
            album: Some(album.as_str()),
            cover_url: art_uri.as_deref(),
            duration: dur,
        };
        match controls.set_metadata(meta) {
            Ok(()) => {
                tracing::info!(
                    "[smtc] meta set ok  title=\"{}\"  cover_url={}",
                    title,
                    art_uri.as_deref().unwrap_or("none")
                );
                return Ok(());
            }
            Err(ref e) if art_uri.is_some() => {
                // ── 2단계: cover 때문에 실패 → cover 없이 재시도 ──────────
                tracing::warn!(
                    "[smtc] meta set 실패(cover): {e:?}  → fallback no-cover 재시도"
                );
                let meta_nc = MediaMetadata {
                    title: Some(title.as_str()),
                    artist: Some(artist.as_str()),
                    album: Some(album.as_str()),
                    cover_url: None,
                    duration: dur,
                };
                match controls.set_metadata(meta_nc) {
                    Ok(()) => tracing::info!("[smtc] meta set ok (no cover)  title=\"{}\"", title),
                    Err(e2) => tracing::error!("[smtc] meta set 실패 (no-cover도 실패): {e2:?}"),
                }
            }
            Err(e) => {
                // cover 없는데 실패 — 다른 원인
                tracing::error!("[smtc] meta set 실패 (cover=none): {e:?}");
            }
        }
    }
    Ok(())
}

/// FE가 재생 상태/위치 변경 시 호출. SMTC 재생 상태 갱신.
#[tauri::command]
pub fn update_smtc_playback(
    state: State<'_, MediaControlsState>,
    status: String, // "playing" | "paused" | "stopped"
    position_ms: Option<u64>,
) -> Result<(), String> {
    let pos = position_ms.map(|ms| MediaPosition(Duration::from_millis(ms)));
    let playback = match status.as_str() {
        "playing" => MediaPlayback::Playing { progress: pos },
        "paused" => MediaPlayback::Paused { progress: pos },
        _ => MediaPlayback::Stopped,
    };

    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(controls) = guard.as_mut() {
        match controls.set_playback(playback) {
            Ok(()) => tracing::info!("[smtc] playback status={status}"),
            Err(e) => tracing::warn!("[smtc] playback set 실패: {e:?}"),
        }
    }
    Ok(())
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────

/// 절대경로 → file:// URI.
/// 백슬래시 → 슬래시, ASCII 이외(한글·공백 등) → percent-encode.
/// "C:/..." → "file:///C:/..."
fn path_to_file_uri(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    let mut encoded = String::with_capacity(normalized.len() * 3 / 2);
    for byte in normalized.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9'
            | b'-' | b'_' | b'.' | b'~' | b'/' | b':' => encoded.push(byte as char),
            other => {
                encoded.push('%');
                encoded.push(char::from_digit((other >> 4) as u32, 16).unwrap().to_ascii_uppercase());
                encoded.push(char::from_digit((other & 0xF) as u32, 16).unwrap().to_ascii_uppercase());
            }
        }
    }
    if encoded.starts_with('/') {
        format!("file://{encoded}")
    } else {
        format!("file:///{encoded}")
    }
}

#[cfg(test)]
mod tests {
    use super::path_to_file_uri;

    #[test]
    fn ascii_path() {
        assert_eq!(path_to_file_uri("C:\\Users\\user\\art.jpg"), "file:///C:/Users/user/art.jpg");
    }

    #[test]
    fn path_with_spaces() {
        assert_eq!(path_to_file_uri("C:/My Music/art.jpg"), "file:///C:/My%20Music/art.jpg");
    }

    #[test]
    fn korean_path() {
        let result = path_to_file_uri("C:/음악/cover.jpg");
        assert!(result.starts_with("file:///C:/"));
        assert!(result.contains('%'));
        assert!(result.ends_with("cover.jpg"));
    }
}
