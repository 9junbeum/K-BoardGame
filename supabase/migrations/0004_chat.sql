-- 대국방 채팅
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.

create table if not exists game_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms(id) on delete cascade,
  player_id text not null,
  nickname text not null,
  message text not null,
  created_at timestamptz default now()
);

create index if not exists game_chat_messages_room_id_idx
  on game_chat_messages (room_id, created_at);

alter table game_chat_messages enable row level security;

create policy "chat_select" on game_chat_messages
  for select using (true);
create policy "chat_insert" on game_chat_messages
  for insert with check (true);

alter publication supabase_realtime add table game_chat_messages;
