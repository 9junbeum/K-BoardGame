import { generateId } from "@/lib/id";

// 익명 플레이어 식별 — localStorage에 UUID 저장
const PLAYER_ID_KEY = "omok:player_id";
const NICKNAME_KEY = "omok:nickname";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getStoredNickname(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NICKNAME_KEY) ?? "";
}

export function storeNickname(nickname: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname.trim());
}
