//! Windows 오디오 출력 엔드포인트 변경 감시 (Windows 전용).
//!
//! 2초마다 활성 렌더 장치 수를 폴링한다.
//! - 활성 장치 0개로 줄면 "output_device_lost" emit → FE가 설정에 따라 일시정지
//! - 0개에서 다시 생기면 "output_device_restored" emit (자동 재생은 FE 설정에 따름)
//!
//! IMMNotificationClient 콜백보다 단순하고 COM 스레딩 문제가 없다.
//! 감지 지연은 최대 2초 (실사용에서 충분).

use tauri::{AppHandle, Emitter};
use windows::Win32::Media::Audio::{
    eRender, IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
};

/// 현재 활성(연결된) 렌더 엔드포인트 수를 반환. COM 오류 시 0.
fn count_active_render_devices(enumerator: &IMMDeviceEnumerator) -> u32 {
    unsafe {
        let collection = enumerator
            .EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .ok();
        match collection {
            Some(c) => c.GetCount().unwrap_or(0),
            None => 0,
        }
    }
}

/// 출력 장치 폴링 스레드를 시작한다. 앱 setup에서 한 번 호출.
pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        // CoInitializeEx: windows-rs 0.58에서 HRESULT 반환 (S_OK=0, S_FALSE=1은 모두 성공)
        unsafe {
            let hr = CoInitializeEx(None, COINIT_MULTITHREADED);
            // hr < 0 이면 실패 (S_FALSE=1은 "already initialized"로 정상)
            if hr.0 < 0 {
                tracing::error!("[output] CoInitializeEx 실패: HRESULT={:#010x}", hr.0);
                return;
            }

            let enumerator: IMMDeviceEnumerator =
                match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) {
                    Ok(e) => e,
                    Err(e) => {
                        tracing::error!("[output] IMMDeviceEnumerator 생성 실패: {e:?}");
                        return;
                    }
                };

            let mut prev_count = count_active_render_devices(&enumerator);
            tracing::info!("[output] audio device watcher started (polling 2s), initial active devices: {prev_count}");

            loop {
                std::thread::sleep(std::time::Duration::from_secs(2));
                let cur_count = count_active_render_devices(&enumerator);

                if cur_count == 0 && prev_count > 0 {
                    tracing::warn!("[output] active render devices → 0 (모두 제거/비활성화)");
                    app.emit("output_device_lost", ()).ok();
                } else if cur_count > 0 && prev_count == 0 {
                    tracing::info!("[output] active render device restored (count={cur_count})");
                    app.emit("output_device_restored", ()).ok();
                }

                prev_count = cur_count;
            }
        }
    });
}
