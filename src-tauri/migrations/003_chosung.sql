-- 초성 전체 시퀀스 컬럼 추가 (초성 검색용)
-- 기존 트랙은 DEFAULT ''로 채워지고, 다음 스캔 시 갱신됨
ALTER TABLE tracks ADD COLUMN chosung_title  TEXT NOT NULL DEFAULT '';
ALTER TABLE tracks ADD COLUMN chosung_artist TEXT NOT NULL DEFAULT '';
