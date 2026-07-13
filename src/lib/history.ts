import type { SupabaseClient } from "@supabase/supabase-js";
import { generateId } from "@/lib/id";

export type GameResult = "win" | "lose" | "draw";

export interface GameRecord {
  id: string;
  roomId: string | null;
  gameType: "omok" | "yut" | "go" | "othello" | "sagmok" | "memory" | "checkers";
  result: GameResult;
  opponentNickname: string;
  /** 게임별 착수 기록 — 표시용으로 길이만 사용하므로 게임마다 다른 모양을 허용한다 */
  moves: unknown[] | null;
  playedAt: string; // ISO
}

const HISTORY_KEY = "omok:history";
const MAX_LOCAL_RECORDS = 50;

// ---------- 익명: localStorage ----------

export function loadLocalHistory(): GameRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as GameRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalRecord(record: Omit<GameRecord, "id" | "playedAt">): GameRecord {
  const full: GameRecord = {
    ...record,
    id: generateId(),
    playedAt: new Date().toISOString(),
  };
  const list = [full, ...loadLocalHistory()].slice(0, MAX_LOCAL_RECORDS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  return full;
}

// ---------- 로그인: Supabase ----------

export async function saveServerRecord(
  supabase: SupabaseClient,
  userId: string,
  record: Omit<GameRecord, "id" | "playedAt">,
): Promise<void> {
  const { error } = await supabase.from("game_history").insert({
    user_id: userId,
    room_id: record.roomId,
    game_type: record.gameType,
    result: record.result,
    opponent_nickname: record.opponentNickname,
    moves: record.moves,
  });
  if (error) throw error;
}

export async function loadServerHistory(
  supabase: SupabaseClient,
  userId: string,
): Promise<GameRecord[]> {
  const { data, error } = await supabase
    .from("game_history")
    .select("id, room_id, game_type, result, opponent_nickname, moves, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(MAX_LOCAL_RECORDS);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    roomId: r.room_id as string | null,
    gameType: (r.game_type as "omok" | "yut" | "go" | "othello" | "sagmok" | "memory" | "checkers") ?? "omok",
    result: r.result as GameResult,
    opponentNickname: (r.opponent_nickname as string) ?? "?",
    moves: r.moves as unknown[] | null,
    playedAt: r.played_at as string,
  }));
}

export const RESULT_LABEL: Record<GameResult, string> = {
  win: "승",
  lose: "패",
  draw: "무",
};
