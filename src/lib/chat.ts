import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChatMessage {
  id: string;
  roomId: string;
  playerId: string;
  nickname: string;
  message: string;
  createdAt: string;
}

const MAX_MESSAGE_LENGTH = 300;
const MAX_HISTORY = 200;

export async function loadChatMessages(supabase: SupabaseClient, roomId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("game_chat_messages")
    .select("id, room_id, player_id, nickname, message, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY);
  if (error) throw error;
  return (data ?? []).map(rowToMessage);
}

export async function sendChatMessage(
  supabase: SupabaseClient,
  roomId: string,
  playerId: string,
  nickname: string,
  message: string,
): Promise<void> {
  const trimmed = message.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) return;
  const { error } = await supabase.from("game_chat_messages").insert({
    room_id: roomId,
    player_id: playerId,
    nickname,
    message: trimmed,
  });
  if (error) throw error;
}

export function rowToMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string,
    roomId: r.room_id as string,
    playerId: r.player_id as string,
    nickname: r.nickname as string,
    message: r.message as string,
    createdAt: r.created_at as string,
  };
}
