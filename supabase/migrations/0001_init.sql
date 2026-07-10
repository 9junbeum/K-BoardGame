-- 오목 온라인 초기 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

-- 게임 방
create table if not exists game_rooms (
  id uuid primary key default gen_random_uuid(),
  game_type text not null default 'omok',
  status text not null default 'waiting', -- waiting | playing | finished
  state jsonb not null,                   -- { moves: [{x, y, c}] }
  current_turn text,                      -- 현재 차례인 player_id
  winner text,                            -- 승자 player_id, 무승부는 'draw'
  created_at timestamptz default now(),
  finished_at timestamptz
);

-- 방 참가자 (익명 또는 로그인 유저)
create table if not exists game_players (
  room_id uuid references game_rooms(id) on delete cascade,
  player_id text not null,                -- 익명: 클라이언트 UUID, 로그인: auth.uid()
  user_id uuid references auth.users(id), -- 로그인 유저면 채움
  nickname text not null,
  color text,                             -- 'b' | 'w'
  joined_at timestamptz default now(),
  primary key (room_id, player_id)
);

-- 게임 기록 (로그인 유저만 서버 저장)
create table if not exists game_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  room_id uuid,
  game_type text not null,
  result text not null,                   -- 'win' | 'lose' | 'draw'
  opponent_nickname text,
  moves jsonb,
  played_at timestamptz default now()
);

-- ---------- Row Level Security ----------

alter table game_rooms enable row level security;
alter table game_players enable row level security;
alter table game_history enable row level security;

-- 방: 익명 포함 누구나 읽기/만들기/업데이트 (링크 공유 모델)
create policy "rooms_select" on game_rooms
  for select using (true);
create policy "rooms_insert" on game_rooms
  for insert with check (true);
create policy "rooms_update" on game_rooms
  for update using (true);

-- 참가자: 누구나 읽기/참가
create policy "players_select" on game_players
  for select using (true);
create policy "players_insert" on game_players
  for insert with check (true);

-- 기록: 본인 것만
create policy "history_select_own" on game_history
  for select using (auth.uid() = user_id);
create policy "history_insert_own" on game_history
  for insert with check (auth.uid() = user_id);

-- ---------- Realtime ----------
-- postgres_changes 구독을 위해 publication에 테이블 추가
alter publication supabase_realtime add table game_rooms;
alter publication supabase_realtime add table game_players;
