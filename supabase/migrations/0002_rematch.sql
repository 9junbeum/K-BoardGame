-- 재대결 기능: 신청/수락/거절 상태 저장
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
alter table game_rooms add column if not exists rematch jsonb;
