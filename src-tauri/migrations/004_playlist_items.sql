-- Migration 003: playlist_items 독립 id 추가 (SSOT §6 "독립 id로 같은 곡 중복 허용")
-- Phase 4 이전에는 플레이리스트 미사용 → 데이터 없음 → 안전한 재생성
-- sqlx는 이 마이그레이션 전체를 트랜잭션으로 감쌈 (실패 시 전체 롤백)

CREATE TABLE IF NOT EXISTS playlist_items_new (
  id          INTEGER PRIMARY KEY,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id)  ON DELETE CASCADE,
  track_id    INTEGER NOT NULL REFERENCES tracks(id)     ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  UNIQUE(playlist_id, position)
);

-- 혹시라도 기존 데이터가 있으면 복사 (보통 없음)
INSERT INTO playlist_items_new (playlist_id, track_id, position)
  SELECT playlist_id, track_id, position FROM playlist_items;

DROP TABLE playlist_items;
ALTER TABLE playlist_items_new RENAME TO playlist_items;

CREATE INDEX IF NOT EXISTS idx_playlist_items_track
  ON playlist_items(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist
  ON playlist_items(playlist_id, position);
