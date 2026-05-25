pub mod art;
pub mod chosung;
pub mod color;
pub mod metadata;

use crate::db::track_repo::{upsert_track, TrackUpsert};
use crate::state::DbState;
use anyhow::Result;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

const SUPPORTED_EXTS: &[&str] = &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus"];

#[derive(Serialize, Clone)]
pub struct ScanProgress {
    pub scanned: usize,
    pub total: usize,
    pub current_file: String,
}

#[derive(Serialize, Clone)]
pub struct ScanComplete {
    pub inserted: usize,
    pub updated: usize,
    pub errors: usize,
}

/// 등록된 폴더 목록을 받아 스캔 실행.
/// 진행률은 `scan:progress` 이벤트, 완료는 `scan:complete` 이벤트로 emit.
pub async fn scan_folders(
    app: AppHandle,
    folders: Vec<(i64, PathBuf, bool)>, // (folder_id, path, recursive)
) -> Result<()> {
    let pool = {
        let state = app.state::<DbState>();
        state.0.clone()
    };

    let art_cache_dir = app
        .path()
        .app_cache_dir()
        .map(|p| p.join("art_cache"))
        .unwrap_or_else(|_| PathBuf::from("art_cache"));

    // ── Phase 1: 파일 목록 수집 ──────────────────────────────────
    let mut all_files: Vec<(i64, PathBuf)> = Vec::new();
    for (folder_id, root, recursive) in &folders {
        let walker = if *recursive {
            WalkDir::new(root).follow_links(false)
        } else {
            WalkDir::new(root).max_depth(1).follow_links(false)
        };
        for entry in walker.into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                let ext = entry
                    .path()
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_lowercase());
                if let Some(ext) = ext {
                    if SUPPORTED_EXTS.contains(&ext.as_str()) {
                        all_files.push((*folder_id, entry.into_path()));
                    }
                }
            }
        }
    }
    let total = all_files.len();
    tracing::info!("[scan] 파일 발견: {total}개  art_cache={}", art_cache_dir.display());

    // ── Phase 2: 메타데이터 + 아트 추출 (동기, CPU 바운드) ────────
    let t0_meta = Instant::now();
    let mut all_upserts: Vec<TrackUpsert> = Vec::with_capacity(total);
    let mut errors = 0usize;

    for (idx, (folder_id, path)) in all_files.iter().enumerate() {
        if idx % 10 == 0 {
            let _ = app.emit(
                "scan:progress",
                ScanProgress {
                    scanned: idx,
                    total,
                    current_file: path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string(),
                },
            );
        }

        match collect_upsert(path, *folder_id, &art_cache_dir) {
            Ok(u) => all_upserts.push(u),
            Err(e) => {
                errors += 1;
                tracing::error!("[scan] 파일 처리 실패  path={}  err={e}", path.display());
            }
        }
    }
    tracing::info!(
        "[scan] 메타데이터+아트: {}ms  total={total}  fail={errors}",
        t0_meta.elapsed().as_millis(),
    );

    // ── Phase 3: DB 배치 upsert (단일 트랜잭션) ───────────────────
    let t0_db = Instant::now();
    let mut inserted = 0usize;
    let mut updated = 0usize;

    let mut tx = pool.begin().await?;
    for u in &all_upserts {
        match upsert_track(&mut tx, u).await {
            Ok(true) => inserted += 1,
            Ok(false) => updated += 1,
            Err(e) => {
                errors += 1;
                tracing::error!("[scan] DB upsert 실패  path={}  err={e}", u.path);
            }
        }
    }
    tx.commit().await?;
    tracing::info!(
        "[scan] DB 배치 커밋: {}ms  inserted={inserted}  updated={updated}  errors={errors}",
        t0_db.elapsed().as_millis()
    );

    let _ = app.emit(
        "scan:progress",
        ScanProgress { scanned: total, total, current_file: String::new() },
    );
    let _ = app.emit("scan:complete", ScanComplete { inserted, updated, errors });

    Ok(())
}

/// 파일 1개의 메타데이터 + 아트 추출 → TrackUpsert 빌드 (동기).
fn collect_upsert(path: &Path, folder_id: i64, art_cache_dir: &Path) -> Result<TrackUpsert> {
    let meta = metadata::read_metadata(path)?;

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let display_title = meta.raw_title.as_deref().unwrap_or(&filename).to_string();
    let display_artist = meta.raw_artist.as_deref().unwrap_or("").to_string();
    let display_album = meta.raw_album.as_deref().unwrap_or("").to_string();

    let sort_title = chosung::sort_key(&display_title);
    let sort_artist = chosung::sort_key(&display_artist);
    let sort_album = chosung::sort_key(&display_album);
    let initial_title = chosung::initial_key(&display_title);
    let initial_artist = chosung::initial_key(&display_artist);
    let chosung_title = chosung::chosung_sequence(&display_title);
    let chosung_artist = chosung::chosung_sequence(&display_artist);

    let (art_cache_path, dominant_color) = if let Some(cover) = &meta.cover_data {
        tracing::debug!(
            "[scan][art] 커버 발견  bytes={}  file={}",
            cover.len(),
            path.file_name().and_then(|n| n.to_str()).unwrap_or("")
        );
        let thumb = match art::save_thumbnail(cover, path, art_cache_dir) {
            Ok(p) => {
                tracing::debug!("[scan][art] 썸네일 저장: {}", p.display());
                Some(p.to_string_lossy().to_string())
            }
            Err(e) => {
                tracing::error!("[scan][art] 썸네일 저장 실패  path={}  err={e}", path.display());
                None
            }
        };
        let dc = color::dominant_color(cover);
        (thumb, dc)
    } else {
        (None, None)
    };

    let lrc_path = {
        let candidate = path.with_extension("lrc");
        candidate.exists().then(|| candidate.to_string_lossy().to_string())
    };

    let lyrics_source = if lrc_path.is_some() {
        "lrc_file"
    } else if meta.embedded_lyrics.is_some() {
        "embedded"
    } else {
        "none"
    };

    Ok(TrackUpsert {
        path: path.to_string_lossy().to_string(),
        filename,
        raw_title: meta.raw_title,
        raw_artist: meta.raw_artist,
        raw_album: meta.raw_album,
        raw_album_artist: meta.raw_album_artist,
        raw_genre: meta.raw_genre,
        raw_track_no: meta.raw_track_no.map(|n| n as i64),
        raw_disc_no: meta.raw_disc_no.map(|n| n as i64),
        raw_year: meta.raw_year.map(|n| n as i64),
        sort_title,
        sort_artist,
        sort_album,
        initial_title,
        initial_artist,
        chosung_title,
        chosung_artist,
        duration_ms: meta.duration_ms.map(|n| n as i64),
        sample_rate: meta.sample_rate.map(|n| n as i64),
        bitrate: meta.bitrate.map(|n| n as i64),
        codec: meta.codec,
        has_embedded_art: meta.has_embedded_art,
        art_cache_path,
        dominant_color,
        lrc_path,
        lyrics_source: lyrics_source.to_string(),
        folder_id,
        replaygain_track_gain: meta.replaygain_track_gain,
        replaygain_album_gain: meta.replaygain_album_gain,
    })
}
