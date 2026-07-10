-- 방 규칙(삼삼 금지, 선공 지정) + 무르기 상태
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
alter table game_rooms add column if not exists rules jsonb;
alter table game_rooms add column if not exists undo jsonb;
