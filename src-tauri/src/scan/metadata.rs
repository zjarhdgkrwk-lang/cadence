use anyhow::Result;
use lofty::{
    file::{AudioFile, TaggedFileExt},
    read_from_path,
    tag::Accessor,
};
use std::path::Path;

/// lofty에서 추출한 트랙 원본 메타데이터
#[derive(Debug, Default)]
pub struct TrackMeta {
    pub raw_title: Option<String>,
    pub raw_artist: Option<String>,
    pub raw_album: Option<String>,
    pub raw_album_artist: Option<String>,
    pub raw_genre: Option<String>,
    pub raw_track_no: Option<u32>,
    pub raw_disc_no: Option<u32>,
    pub raw_year: Option<u32>,

    pub duration_ms: Option<u64>,
    pub sample_rate: Option<u32>,
    pub bitrate: Option<u32>,
    pub codec: Option<String>,

    pub has_embedded_art: bool,
    /// 임베디드 커버 원본 바이트 (JPEG 또는 PNG)
    pub cover_data: Option<Vec<u8>>,

    pub embedded_lyrics: Option<String>,

    /// ReplayGain 트랙 게인 (dB). None = 태그 없음.
    pub replaygain_track_gain: Option<f64>,
    /// ReplayGain 앨범 게인 (dB). None = 태그 없음.
    pub replaygain_album_gain: Option<f64>,
}

/// "-6.03 dB", "+1.23dB", "-6.03" 등의 문자열을 f64로 파싱.
fn parse_gain_db(s: &str) -> Option<f64> {
    let s = s.trim();
    // "dB" 접미사 제거 (대소문자 무관)
    let s = if s.to_ascii_uppercase().ends_with("DB") {
        s[..s.len() - 2].trim()
    } else {
        s
    };
    s.parse::<f64>().ok()
}

pub fn read_metadata(path: &Path) -> Result<TrackMeta> {
    let tagged = read_from_path(path)?;
    let mut meta = TrackMeta::default();

    // 오디오 속성
    let props = tagged.properties();
    meta.duration_ms = Some(props.duration().as_millis() as u64);
    meta.sample_rate = props.sample_rate();
    meta.bitrate = props.overall_bitrate();
    meta.codec = Some(format!("{:?}", tagged.file_type()));

    // 태그 (첫 번째 태그 우선)
    if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
        meta.raw_title = tag.title().map(|s| s.to_string());
        meta.raw_artist = tag.artist().map(|s| s.to_string());
        meta.raw_album = tag.album().map(|s| s.to_string());
        meta.raw_album_artist = tag
            .get_string(&lofty::tag::ItemKey::AlbumArtist)
            .map(|s| s.to_string());
        meta.raw_genre = tag.genre().map(|s| s.to_string());
        meta.raw_track_no = tag.track();
        meta.raw_disc_no = tag.disk();
        meta.raw_year = tag.year();

        // 임베디드 커버
        if let Some(pic) = tag.pictures().first() {
            meta.has_embedded_art = true;
            meta.cover_data = Some(pic.data().to_vec());
        }

        // 임베디드 가사
        meta.embedded_lyrics = tag
            .get_string(&lofty::tag::ItemKey::Lyrics)
            .map(|s| s.to_string());

        // ReplayGain 태그 (ID3v2 TXXX / Vorbis comment / MP4 atom 등 lofty가 통일 처리)
        meta.replaygain_track_gain = tag
            .get_string(&lofty::tag::ItemKey::ReplayGainTrackGain)
            .and_then(parse_gain_db);
        meta.replaygain_album_gain = tag
            .get_string(&lofty::tag::ItemKey::ReplayGainAlbumGain)
            .and_then(parse_gain_db);
    }

    Ok(meta)
}
