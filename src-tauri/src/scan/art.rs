use anyhow::{Context, Result};
use image::{imageops::FilterType, DynamicImage, ImageFormat};
use sha2::{Digest, Sha256};
use std::{
    io::Cursor,
    path::{Path, PathBuf},
};

/// art_cache_dir 아래 256×256 JPEG 썸네일 저장.
/// 이미 존재하면 재생성하지 않음.
/// 반환값: 캐시 파일 절대 경로
pub fn save_thumbnail(
    cover_data: &[u8],
    track_path: &Path,
    art_cache_dir: &Path,
) -> Result<PathBuf> {
    let hash = thumb_hash(track_path);
    let out_path = art_cache_dir.join(format!("{hash}.jpg"));

    if out_path.exists() {
        return Ok(out_path);
    }

    std::fs::create_dir_all(art_cache_dir)?;

    let img = image::load_from_memory(cover_data)
        .context("커버 이미지 디코딩 실패")?;
    let thumb = resize_cover(img);

    let mut buf = Cursor::new(Vec::new());
    thumb
        .write_to(&mut buf, ImageFormat::Jpeg)
        .context("JPEG 인코딩 실패")?;
    std::fs::write(&out_path, buf.into_inner())?;

    Ok(out_path)
}

fn resize_cover(img: DynamicImage) -> DynamicImage {
    let (w, h) = (img.width(), img.height());
    if w <= 256 && h <= 256 {
        return img;
    }
    img.resize_to_fill(256, 256, FilterType::Triangle)
}

/// 트랙 경로를 기반으로 16자리 hex 해시 생성 (썸네일 파일명)
pub fn thumb_hash(track_path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(track_path.to_string_lossy().as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..8]) // 16 hex chars
}
