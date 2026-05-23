-- Cadence initial schema (SSOT §6, CLAUDE.md §아키텍처 규칙)
-- raw_* = 파일 태그 원본, *_override = 사용자 편집
-- 표시값: COALESCE(override, raw, filename)
-- NOTE: PRAGMA journal_mode/foreign_keys는 SqliteConnectOptions에서 설정

-- ──────────────────────────────────────────
-- 1. folders: 감시 대상 루트 폴더
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS folders (
  id         INTEGER PRIMARY KEY,
  path       TEXT    NOT NULL UNIQUE,
  recursive  INTEGER NOT NULL DEFAULT 1,
  added_at   INTEGER NOT NULL
);

-- ──────────────────────────────────────────
-- 2. tracks: 음악 파일 메타데이터
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id                    INTEGER PRIMARY KEY,
  path                  TEXT    NOT NULL UNIQUE,
  filename              TEXT    NOT NULL,

  -- 원본 태그
  raw_title             TEXT,
  raw_artist            TEXT,
  raw_album             TEXT,
  raw_album_artist      TEXT,
  raw_genre             TEXT,
  raw_track_no          INTEGER,
  raw_disc_no           INTEGER,
  raw_year              INTEGER,

  -- 사용자 오버라이드
  title_override        TEXT,
  artist_override       TEXT,
  album_override        TEXT,
  album_artist_override TEXT,
  genre_override        TEXT,
  track_no_override     INTEGER,
  disc_no_override      INTEGER,
  year_override         INTEGER,

  -- 정렬/초성 키 (스캔 시 사전 계산)
  sort_title            TEXT,
  sort_artist           TEXT,
  sort_album            TEXT,
  initial_title         TEXT,
  initial_artist        TEXT,

  -- 오디오 속성
  duration_ms           INTEGER,
  sample_rate           INTEGER,
  bitrate               INTEGER,
  codec                 TEXT,

  -- 앨범아트 / 적응형 색상
  has_embedded_art      INTEGER NOT NULL DEFAULT 0,
  art_cache_path        TEXT,
  dominant_color        TEXT,

  -- 가사
  lrc_path              TEXT,
  lyrics_source         TEXT CHECK(lyrics_source IN ('lrc_file', 'embedded', 'none'))
                              DEFAULT 'none',
  lrc_offset_ms         INTEGER NOT NULL DEFAULT 0,

  -- 상태
  missing               INTEGER NOT NULL DEFAULT 0,
  date_added            INTEGER NOT NULL,
  last_played_at        INTEGER,
  play_count            INTEGER NOT NULL DEFAULT 0,
  folder_id             INTEGER REFERENCES folders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist
  ON tracks(sort_artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album
  ON tracks(album_artist_override, raw_album_artist, sort_album);
CREATE INDEX IF NOT EXISTS idx_tracks_missing
  ON tracks(missing);
CREATE INDEX IF NOT EXISTS idx_tracks_date_added
  ON tracks(date_added);
CREATE INDEX IF NOT EXISTS idx_tracks_last_played
  ON tracks(last_played_at);
CREATE INDEX IF NOT EXISTS idx_tracks_play_count
  ON tracks(play_count);

-- ──────────────────────────────────────────
-- 3. playlists / playlist_items
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlists (
  id         INTEGER PRIMARY KEY,
  name       TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_items (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    INTEGER NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, position)
);
CREATE INDEX IF NOT EXISTS idx_playlist_items_track
  ON playlist_items(track_id);

-- ──────────────────────────────────────────
-- 4. tags / track_tags
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  color TEXT
);

CREATE TABLE IF NOT EXISTS track_tags (
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (track_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_track_tags_tag
  ON track_tags(tag_id);

-- ──────────────────────────────────────────
-- 5. 큐: queue_state(singleton) + queue_items + queue_history
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_state (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  current_index INTEGER,
  shuffle       INTEGER NOT NULL DEFAULT 0,
  repeat_mode   TEXT    NOT NULL DEFAULT 'no_repeat'
                CHECK(repeat_mode IN ('one_track','repeat_one','repeat_all','no_repeat')),
  ab_loop_a_ms  INTEGER,
  ab_loop_b_ms  INTEGER,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS queue_items (
  position  INTEGER PRIMARY KEY,
  track_id  INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  added_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_queue_items_track
  ON queue_items(track_id);

CREATE TABLE IF NOT EXISTS queue_history (
  id        INTEGER PRIMARY KEY,
  track_id  INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  played_at INTEGER NOT NULL,
  source    TEXT
);
CREATE INDEX IF NOT EXISTS idx_queue_history_played_at
  ON queue_history(played_at);

-- ──────────────────────────────────────────
-- 6. app_state: 키-값 영속 상태
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ──────────────────────────────────────────
-- 7. FTS5: 실시간 검색 (SSOT §6, CLAUDE.md "FTS5에 태그 포함")
--    content='' — contentless; 트리거로 직접 채움 (2단계에서 트리거 추가)
-- ──────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
  title,
  artist,
  album,
  album_artist,
  tags,
  content=''
);

-- ──────────────────────────────────────────
-- 8. 싱글톤 시드
-- ──────────────────────────────────────────
INSERT OR IGNORE INTO queue_state (id, updated_at)
  VALUES (1, CAST(strftime('%s', 'now') AS INTEGER) * 1000);
