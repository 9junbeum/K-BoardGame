import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Rules } from "@/games/omok/logic";

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
export interface UndoState {
  by?: string; // 무르기를 신청한 player_id
  declined?: string; // 거절당한 신청자 player_id
  used?: string[]; // 무르기를 이미 사용한 player_id 목록
}

export interface RematchState {
  by?: string; // 신청한 player_id
  declined?: boolean; // 거절됨
  next_room_id?: string; // 수락되어 만들어진 새 방
}

export interface RoomRow {
  id: string;
  game_type: string;
  status: "waiting" | "playing" | "finished";
  state: { moves: { x: number; y: number; c: "b" | "w" }[] };
  current_turn: string | null;
  winner: string | null; // player_id 또는 'draw'
  rules: Rules | null;
  undo: UndoState | null;
  rematch: RematchState | null;
  created_at: string;
  finished_at: string | null;
}

export interface PlayerRow {
  room_id: string;
  player_id: string;
  user_id: string | null;
  nickname: string;
  color: string | null; // 오목: 'b'|'w', 윷놀이: "0".."3" (입장 순서)
  joined_at: string;
}
