import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** env가 설정되어 있으면 true. false면 로컬 전용 모드로 동작 */
export const supabaseEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** 브라우저용 Supabase 클라이언트. env 미설정 시 null */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}

// DB row 타입
export interface RoomRow {
  id: string;
  game_type: string;
  status: "waiting" | "playing" | "finished";
  state: { moves: { x: number; y: number; c: "b" | "w" }[] };
  current_turn: string | null;
  winner: string | null; // player_id 또는 'draw'
  created_at: string;
  finished_at: string | null;
}

export interface PlayerRow {
  room_id: string;
  player_id: string;
  user_id: string | null;
  nickname: string;
  color: "b" | "w" | null;
  joined_at: string;
}
