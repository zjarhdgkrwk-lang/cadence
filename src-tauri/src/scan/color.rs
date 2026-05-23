use image::DynamicImage;
use kmeans_colors::get_kmeans;
use palette::{FromColor, Lab, Srgb};

/// 커버 이미지 바이트에서 dominant_color를 계산해 "#RRGGBB" 문자열로 반환.
pub fn dominant_color(cover_data: &[u8]) -> Option<String> {
    let img = image::load_from_memory(cover_data).ok()?;
    extract_dominant(&img)
}

fn extract_dominant(img: &DynamicImage) -> Option<String> {
    let small = img.resize_to_fill(32, 32, image::imageops::FilterType::Nearest);
    let rgb = small.to_rgb8();

    let pixels: Vec<Lab> = rgb
        .pixels()
        .map(|p| {
            let srgb: Srgb<f32> = Srgb::new(
                p[0] as f32 / 255.0,
                p[1] as f32 / 255.0,
                p[2] as f32 / 255.0,
            );
            Lab::from_color(srgb)
        })
        .collect();

    if pixels.is_empty() {
        return None;
    }

    // k=3 클러스터 → 채도(chroma) 최고 클러스터 선택
    let result = get_kmeans(3usize, 20usize, 5.0f32, false, &pixels, 0u64);

    let best = result
        .centroids
        .iter()
        .max_by(|a, b| {
            let ca = (a.a * a.a + a.b * a.b).sqrt();
            let cb = (b.a * b.a + b.b * b.b).sqrt();
            ca.partial_cmp(&cb).unwrap_or(std::cmp::Ordering::Equal)
        })?;

    let srgb: Srgb<f32> = Srgb::from_color(*best);
    let r = (srgb.red.clamp(0.0, 1.0) * 255.0).round() as u8;
    let g = (srgb.green.clamp(0.0, 1.0) * 255.0).round() as u8;
    let b = (srgb.blue.clamp(0.0, 1.0) * 255.0).round() as u8;

    Some(format!("#{r:02X}{g:02X}{b:02X}"))
}
