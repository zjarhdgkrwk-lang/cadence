use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

/// upsert용 입력 구조체
pub struct TrackUpsert {
    pub path: String,
    pub filename: String,
    pub raw_title: Option<String>,
    pub raw_artist: Option<String>,
    pub raw_album: Option<String>,
    pub raw_album_artist: Option<String>,
    pub raw_genre: Option<String>,
    pub raw_track_no: Option<i64>,
    pub raw_disc_no: Option<i64>,
    pub raw_year: Option<i64>,
    pub sort_title: String,
    pub sort_artist: String,
    pub sort_album: String,
    pub initial_title: String,
    pub initial_artist: String,
    pub chosung_title: String,
    pub chosung_artist: String,
    pub duration_ms: Option<i64>,
    pub sample_rate: Option<i64>,
    pub bitrate: Option<i64>,
    pub codec: Option<String>,
    pub has_embedded_art: bool,
    pub art_cache_path: Option<String>,
    pub dominant_color: Option<String>,
    pub lrc_path: Option<String>,
    pub lyrics_source: String,
    pub folder_id: i64,
    pub replaygain_track_gain: Option<f64>,
    pub replaygain_album_gain: Option<f64>,
}

/// 프런트엔드로 직렬화해 내보내는 트랙 행
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TrackRow {
    pub id: i64,
    pub path: String,
    pub filename: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub track_no: Option<i64>,
    pub disc_no: Option<i64>,
    pub year: Option<i64>,
    pub duration_ms: Option<i64>,
    pub bitrate: Option<i64>,
    pub codec: Option<String>,
    pub has_embedded_art: bool,
    pub art_cache_path: Option<String>,
    pub dominant_color: Option<String>,
    pub lrc_path: Option<String>,
    pub lrc_offset_ms: i64,
    pub lyrics_source: String,
    pub missing: bool,
    pub date_added: i64,
    pub last_played_at: Option<i64>,
    pub play_count: i64,
    pub replaygain_track_gain: Option<f64>,
    pub replaygain_album_gain: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageResult {
    pub tracks: Vec<TrackRow>,
    pub total: i64,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// 트랜잭션 안에서 tracks 테이블에 upsert. 반환: true=신규, false=업데이트.
pub async fn upsert_track(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    u: &TrackUpsert,
) -> Result<bool> {
    let exists: Option<(i64,)> = sqlx::query_as("SELECT id FROM tracks WHERE path = ?")
        .bind(&u.path)
        .fetch_optional(&mut **tx)
        .await?;

    if exists.is_some() {
        sqlx::query(
            "UPDATE tracks SET
               filename=?, raw_title=?, raw_artist=?, raw_album=?, raw_album_artist=?,
               raw_genre=?, raw_track_no=?, raw_disc_no=?, raw_year=?,
               sort_title=?, sort_artist=?, sort_album=?, initial_title=?, initial_artist=?,
               chosung_title=?, chosung_artist=?,
               duration_ms=?, sample_rate=?, bitrate=?, codec=?,
               has_embedded_art=?, art_cache_path=?, dominant_color=?,
               lrc_path=?, lyrics_source=?, folder_id=?,
               replaygain_track_gain=?, replaygain_album_gain=?,
               missing=0
             WHERE path=?",
        )
        .bind(&u.filename)
        .bind(&u.raw_title)
        .bind(&u.raw_artist)
        .bind(&u.raw_album)
        .bind(&u.raw_album_artist)
        .bind(&u.raw_genre)
        .bind(u.raw_track_no)
        .bind(u.raw_disc_no)
        .bind(u.raw_year)
        .bind(&u.sort_title)
        .bind(&u.sort_artist)
        .bind(&u.sort_album)
        .bind(&u.initial_title)
        .bind(&u.initial_artist)
        .bind(&u.chosung_title)
        .bind(&u.chosung_artist)
        .bind(u.duration_ms)
        .bind(u.sample_rate)
        .bind(u.bitrate)
        .bind(&u.codec)
        .bind(u.has_embedded_art as i64)
        .bind(&u.art_cache_path)
        .bind(&u.dominant_color)
        .bind(&u.lrc_path)
        .bind(&u.lyrics_source)
        .bind(u.folder_id)
        .bind(u.replaygain_track_gain)
        .bind(u.replaygain_album_gain)
        .bind(&u.path)
        .execute(&mut **tx)
        .await?;
        Ok(false)
    } else {
        sqlx::query(
            "INSERT INTO tracks (
               path, filename, raw_title, raw_artist, raw_album, raw_album_artist,
               raw_genre, raw_track_no, raw_disc_no, raw_year,
               sort_title, sort_artist, sort_album, initial_title, initial_artist,
               chosung_title, chosung_artist,
               duration_ms, sample_rate, bitrate, codec,
               has_embedded_art, art_cache_path, dominant_color,
               lrc_path, lyrics_source, folder_id,
               replaygain_track_gain, replaygain_album_gain,
               date_added
             ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(&u.path)
        .bind(&u.filename)
        .bind(&u.raw_title)
        .bind(&u.raw_artist)
        .bind(&u.raw_album)
        .bind(&u.raw_album_artist)
        .bind(&u.raw_genre)
        .bind(u.raw_track_no)
        .bind(u.raw_disc_no)
        .bind(u.raw_year)
        .bind(&u.sort_title)
        .bind(&u.sort_artist)
        .bind(&u.sort_album)
        .bind(&u.initial_title)
        .bind(&u.initial_artist)
        .bind(&u.chosung_title)
        .bind(&u.chosung_artist)
        .bind(u.duration_ms)
        .bind(u.sample_rate)
        .bind(u.bitrate)
        .bind(&u.codec)
        .bind(u.has_embedded_art as i64)
        .bind(&u.art_cache_path)
        .bind(&u.dominant_color)
        .bind(&u.lrc_path)
        .bind(&u.lyrics_source)
        .bind(u.folder_id)
        .bind(u.replaygain_track_gain)
        .bind(u.replaygain_album_gain)
        .bind(now_ms())
        .execute(&mut **tx)
        .await?;
        Ok(true)
    }
}

/// ID로 단일 트랙 조회 (큐 복원용)
pub async fn get_track_by_id(pool: &SqlitePool, id: i64) -> Result<Option<TrackRow>> {
    let sql = format!("{TRACK_SELECT} WHERE id=? AND missing=0");
    Ok(sqlx::query_as(&sql).bind(id).fetch_optional(pool).await?)
}

/// 정렬 + 페이지네이션으로 트랙 조회
pub async fn get_tracks(
    pool: &SqlitePool,
    sort_field: &str,
    sort_dir: &str,
    offset: i64,
    limit: i64,
) -> Result<PageResult> {
    let col = match sort_field {
        "title"       => "sort_title",
        "artist"      => "sort_artist",
        "album"       => "sort_album",
        "date_added"  => "date_added",
        "play_count"  => "play_count",
        "last_played" => "last_played_at",
        _             => "sort_artist",
    };
    let dir = if sort_dir == "desc" { "DESC" } else { "ASC" };

    let order = match col {
        "sort_artist" => format!(
            "sort_artist {dir}, sort_album ASC, COALESCE(raw_disc_no,1) ASC, COALESCE(raw_track_no,0) ASC"
        ),
        "sort_album" => format!(
            "sort_album {dir}, COALESCE(raw_disc_no,1) ASC, COALESCE(raw_track_no,0) ASC"
        ),
        _ => format!("{col} {dir}"),
    };

    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tracks WHERE missing=0")
        .fetch_one(pool)
        .await?;

    let sql = format!(
        "SELECT id,path,filename,
           COALESCE(title_override,raw_title,filename) AS title,
           COALESCE(artist_override,raw_artist,'') AS artist,
           COALESCE(album_override,raw_album,'') AS album,
           COALESCE(album_artist_override,raw_album_artist) AS album_artist,
           COALESCE(genre_override,raw_genre) AS genre,
           COALESCE(track_no_override,raw_track_no) AS track_no,
           COALESCE(disc_no_override,raw_disc_no) AS disc_no,
           COALESCE(year_override,raw_year) AS year,
           duration_ms, bitrate, codec,
           has_embedded_art, art_cache_path, dominant_color,
           lrc_path, lrc_offset_ms,
           lyrics_source, missing, date_added, last_played_at, play_count,
           replaygain_track_gain, replaygain_album_gain
         FROM tracks WHERE missing=0
         ORDER BY {order}
         LIMIT ? OFFSET ?"
    );

    let rows: Vec<TrackRow> = sqlx::query_as(&sql)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

    Ok(PageResult { tracks: rows, total: total.0 })
}

/// FTS5 특수문자를 phrase query로 이스케이프. 단어별로 prefix 검색.
fn escape_fts5(query: &str) -> String {
    query
        .split_whitespace()
        .map(|w| format!("\"{}\"*", w.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" ")
}

/// 문자열이 한글 자음(ㄱ–ㅎ)만으로 이루어졌는지 확인.
fn is_chosung_only(s: &str) -> bool {
    let s = s.trim();
    !s.is_empty() && s.chars().all(|c| (0x3131u32..=0x314Eu32).contains(&(c as u32)))
}

const TRACK_SELECT: &str =
    "SELECT id,path,filename,
       COALESCE(title_override,raw_title,filename) AS title,
       COALESCE(artist_override,raw_artist,'') AS artist,
       COALESCE(album_override,raw_album,'') AS album,
       COALESCE(album_artist_override,raw_album_artist) AS album_artist,
       COALESCE(genre_override,raw_genre) AS genre,
       COALESCE(track_no_override,raw_track_no) AS track_no,
       COALESCE(disc_no_override,raw_disc_no) AS disc_no,
       COALESCE(year_override,raw_year) AS year,
       duration_ms, bitrate, codec,
       has_embedded_art, art_cache_path, dominant_color,
       lrc_path, lrc_offset_ms,
       lyrics_source, missing, date_added, last_played_at, play_count,
       replaygain_track_gain, replaygain_album_gain
     FROM tracks";

/// t 별칭 버전 — search_tracks_v2에서 WHERE/JOIN 조건에 사용
const TRACK_SELECT_T: &str =
    "SELECT t.id, t.path, t.filename,
       COALESCE(t.title_override, t.raw_title, t.filename) AS title,
       COALESCE(t.artist_override, t.raw_artist, '') AS artist,
       COALESCE(t.album_override, t.raw_album, '') AS album,
       COALESCE(t.album_artist_override, t.raw_album_artist) AS album_artist,
       COALESCE(t.genre_override, t.raw_genre) AS genre,
       COALESCE(t.track_no_override, t.raw_track_no) AS track_no,
       COALESCE(t.disc_no_override, t.raw_disc_no) AS disc_no,
       COALESCE(t.year_override, t.raw_year) AS year,
       t.duration_ms, t.bitrate, t.codec,
       t.has_embedded_art, t.art_cache_path, t.dominant_color,
       t.lrc_path, t.lrc_offset_ms,
       t.lyrics_source, t.missing, t.date_added, t.last_played_at, t.play_count,
       t.replaygain_track_gain, t.replaygain_album_gain
     FROM tracks t";

/// FTS5 전문 검색 (일반 텍스트) + 초성 LIKE 검색 자동 분기
pub async fn search_tracks(
    pool: &SqlitePool,
    query: &str,
    offset: i64,
    limit: i64,
) -> Result<PageResult> {
    let q = query.trim();
    if q.is_empty() {
        return Ok(PageResult { tracks: vec![], total: 0 });
    }

    if is_chosung_only(q) {
        // 초성 시퀀스 LIKE 검색
        let pattern = format!("%{q}%");

        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tracks
             WHERE (chosung_title LIKE ? OR chosung_artist LIKE ?) AND missing=0",
        )
        .bind(&pattern)
        .bind(&pattern)
        .fetch_one(pool)
        .await?;

        let sql = format!(
            "{TRACK_SELECT}
             WHERE (chosung_title LIKE ? OR chosung_artist LIKE ?) AND missing=0
             LIMIT ? OFFSET ?"
        );
        let rows: Vec<TrackRow> = sqlx::query_as(&sql)
            .bind(&pattern)
            .bind(&pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        Ok(PageResult { tracks: rows, total: total.0 })
    } else {
        // FTS5 전문 검색
        let fts_query = escape_fts5(q);

        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tracks t
             JOIN tracks_fts f ON f.rowid = t.id
             WHERE f MATCH ? AND t.missing=0",
        )
        .bind(&fts_query)
        .fetch_one(pool)
        .await?;

        let sql =
            "SELECT t.id,t.path,t.filename,
               COALESCE(t.title_override,t.raw_title,t.filename) AS title,
               COALESCE(t.artist_override,t.raw_artist,'') AS artist,
               COALESCE(t.album_override,t.raw_album,'') AS album,
               COALESCE(t.album_artist_override,t.raw_album_artist) AS album_artist,
               COALESCE(t.genre_override,t.raw_genre) AS genre,
               COALESCE(t.track_no_override,t.raw_track_no) AS track_no,
               COALESCE(t.disc_no_override,t.raw_disc_no) AS disc_no,
               COALESCE(t.year_override,t.raw_year) AS year,
               t.duration_ms, t.bitrate, t.codec,
               t.has_embedded_art, t.art_cache_path, t.dominant_color,
               t.lrc_path, t.lrc_offset_ms,
               t.lyrics_source, t.missing, t.date_added, t.last_played_at, t.play_count,
               t.replaygain_track_gain, t.replaygain_album_gain
             FROM tracks t
             JOIN tracks_fts f ON f.rowid = t.id
             WHERE f MATCH ? AND t.missing=0
             LIMIT ? OFFSET ?";
        let rows: Vec<TrackRow> = sqlx::query_as(sql)
            .bind(&fts_query)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        Ok(PageResult { tracks: rows, total: total.0 })
    }
}

/// 필드 필터 + 태그 AND/OR 필터를 지원하는 확장 검색.
/// query가 비고 tag_ids도 비면 일반 get_tracks로 위임.
pub async fn search_tracks_v2(
    pool: &SqlitePool,
    raw_query: &str,
    fields: &[String],
    tag_ids: &[i64],
    tag_mode: &str,
    offset: i64,
    limit: i64,
) -> Result<PageResult> {
    let q = raw_query.trim();
    let has_query = !q.is_empty();
    let has_tags = !tag_ids.is_empty();

    if !has_query && !has_tags {
        return get_tracks(pool, "artist", "asc", offset, limit).await;
    }

    let is_chosung = has_query && is_chosung_only(q);

    // FTS query string (필드 컬럼 필터 포함)
    let fts_query: String = if has_query && !is_chosung {
        let valid_fields: Vec<&str> = fields
            .iter()
            .filter_map(|f| match f.as_str() {
                "title" | "artist" | "album" | "tags" => Some(f.as_str()),
                _ => None,
            })
            .collect();
        let escaped = escape_fts5(q);
        if valid_fields.is_empty() || valid_fields.len() >= 4 {
            escaped
        } else {
            format!("{{{}}} {}", valid_fields.join(" "), escaped)
        }
    } else {
        String::new()
    };

    let chosung_pat: String = if is_chosung {
        format!("%{}%", q)
    } else {
        String::new()
    };

    // IN 절 문자열 (i64이므로 SQL injection 위험 없음)
    let tag_in: String = tag_ids.iter().map(|i| i.to_string()).collect::<Vec<_>>().join(",");

    // WHERE 절 조각 조립
    let mut where_parts: Vec<String> = vec!["t.missing=0".into()];
    if has_query {
        if is_chosung {
            where_parts.push(
                "(t.chosung_title LIKE ? OR t.chosung_artist LIKE ?)".into(),
            );
        } else {
            where_parts.push(
                "t.id IN (SELECT rowid FROM tracks_fts WHERE tracks_fts MATCH ?)".into(),
            );
        }
    }
    if has_tags {
        if tag_mode == "and" {
            where_parts.push(format!(
                "(SELECT COUNT(*) FROM track_tags WHERE track_id=t.id AND tag_id IN ({tag_in})) = {}",
                tag_ids.len()
            ));
        } else {
            where_parts.push(format!(
                "t.id IN (SELECT track_id FROM track_tags WHERE tag_id IN ({tag_in}))"
            ));
        }
    }
    let where_clause = where_parts.join(" AND ");

    // COUNT
    let count_sql = format!("SELECT COUNT(*) FROM tracks t WHERE {where_clause}");
    let total: i64 = if is_chosung {
        sqlx::query_scalar(&count_sql)
            .bind(&chosung_pat)
            .bind(&chosung_pat)
            .fetch_one(pool)
            .await?
    } else if has_query {
        sqlx::query_scalar(&count_sql)
            .bind(&fts_query)
            .fetch_one(pool)
            .await?
    } else {
        sqlx::query_scalar(&count_sql)
            .fetch_one(pool)
            .await?
    };

    // SELECT
    let select_sql = format!(
        "{TRACK_SELECT_T} WHERE {where_clause}
         ORDER BY t.sort_artist ASC, t.sort_album ASC
         LIMIT ? OFFSET ?"
    );
    let rows: Vec<TrackRow> = if is_chosung {
        sqlx::query_as(&select_sql)
            .bind(&chosung_pat)
            .bind(&chosung_pat)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
    } else if has_query {
        sqlx::query_as(&select_sql)
            .bind(&fts_query)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
    } else {
        sqlx::query_as(&select_sql)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
    };

    Ok(PageResult { tracks: rows, total })
}
