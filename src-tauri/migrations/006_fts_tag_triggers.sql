-- Migration 006: FTS5 트리거를 tag-aware 버전으로 갱신
-- tracks 행 변경 시 tags 컬럼을 track_tags 서브쿼리로 채워 검색 정확도 향상.
-- DROP IF EXISTS: 기존 DB(트리거 있음)·새 DB 모두 안전(멱등).
--
-- 주의: tracks_ad 트리거에서 track_tags는 ON DELETE CASCADE로 이미 제거됐으므로
-- 태그 부분은 '' 사용. 실제 검색은 tracks 행 자체가 없으므로 결과에 영향 없음.
-- 태그 배정/해제 시 FTS 동기화는 app 레벨(Rust assign_tags/bulk_assign_tags)에서 수행.

DROP TRIGGER IF EXISTS tracks_ai;
CREATE TRIGGER tracks_ai
AFTER INSERT ON tracks BEGIN
  INSERT INTO tracks_fts(rowid, title, artist, album, album_artist, tags)
  VALUES (
    new.id,
    COALESCE(new.raw_title, ''),
    COALESCE(new.raw_artist, ''),
    COALESCE(new.raw_album, ''),
    COALESCE(new.raw_album_artist, ''),
    ''
  );
END;

DROP TRIGGER IF EXISTS tracks_au;
CREATE TRIGGER tracks_au
AFTER UPDATE ON tracks BEGIN
  INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, album_artist, tags)
  VALUES (
    'delete',
    old.id,
    COALESCE(old.raw_title, ''),
    COALESCE(old.raw_artist, ''),
    COALESCE(old.raw_album, ''),
    COALESCE(old.raw_album_artist, ''),
    COALESCE((
      SELECT GROUP_CONCAT(t.name, ' ')
      FROM tags t JOIN track_tags tt ON tt.tag_id = t.id
      WHERE tt.track_id = old.id
    ), '')
  );
  INSERT INTO tracks_fts(rowid, title, artist, album, album_artist, tags)
  VALUES (
    new.id,
    COALESCE(new.raw_title, ''),
    COALESCE(new.raw_artist, ''),
    COALESCE(new.raw_album, ''),
    COALESCE(new.raw_album_artist, ''),
    COALESCE((
      SELECT GROUP_CONCAT(t.name, ' ')
      FROM tags t JOIN track_tags tt ON tt.tag_id = t.id
      WHERE tt.track_id = new.id
    ), '')
  );
END;

DROP TRIGGER IF EXISTS tracks_ad;
CREATE TRIGGER tracks_ad
AFTER DELETE ON tracks BEGIN
  INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, album_artist, tags)
  VALUES (
    'delete',
    old.id,
    COALESCE(old.raw_title, ''),
    COALESCE(old.raw_artist, ''),
    COALESCE(old.raw_album, ''),
    COALESCE(old.raw_album_artist, ''),
    ''
  );
END;
