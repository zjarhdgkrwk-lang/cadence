-- FTS5 동기화 트리거 (SSOT §6, contentless FTS5 수동 관리)
-- tracks INSERT → tracks_fts에 추가
CREATE TRIGGER IF NOT EXISTS tracks_ai
AFTER INSERT ON tracks BEGIN
  INSERT INTO tracks_fts(rowid, title, artist, album, album_artist, tags)
  VALUES (
    new.id,
    COALESCE(new.raw_title,   ''),
    COALESCE(new.raw_artist,  ''),
    COALESCE(new.raw_album,   ''),
    COALESCE(new.raw_album_artist, ''),
    ''
  );
END;

-- tracks UPDATE → 이전 행 삭제 후 새 행 삽입
CREATE TRIGGER IF NOT EXISTS tracks_au
AFTER UPDATE ON tracks BEGIN
  INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, album_artist, tags)
  VALUES (
    'delete',
    old.id,
    COALESCE(old.raw_title,   ''),
    COALESCE(old.raw_artist,  ''),
    COALESCE(old.raw_album,   ''),
    COALESCE(old.raw_album_artist, ''),
    ''
  );
  INSERT INTO tracks_fts(rowid, title, artist, album, album_artist, tags)
  VALUES (
    new.id,
    COALESCE(new.raw_title,   ''),
    COALESCE(new.raw_artist,  ''),
    COALESCE(new.raw_album,   ''),
    COALESCE(new.raw_album_artist, ''),
    ''
  );
END;

-- tracks DELETE → FTS5에서 삭제
CREATE TRIGGER IF NOT EXISTS tracks_ad
AFTER DELETE ON tracks BEGIN
  INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, album_artist, tags)
  VALUES (
    'delete',
    old.id,
    COALESCE(old.raw_title,   ''),
    COALESCE(old.raw_artist,  ''),
    COALESCE(old.raw_album,   ''),
    COALESCE(old.raw_album_artist, ''),
    ''
  );
END;
