"use client";

import { useCallback, useEffect, useState } from "react";
import { loadChatMessages, rowToMessage, sendChatMessage, type ChatMessage } from "@/lib/chat";
import { getSupabase } from "@/lib/supabase";

export interface UseChatResult {
  messages: ChatMessage[];
  send: (text: string) => void;
}

/** 대국방 채팅 — 입장 시 기록을 불러오고, 이후 새 메시지를 실시간으로 받는다 */
export function useChat(roomId: string, myId: string, nickname: string | null): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !roomId) return;
    let cancelled = false;

    // roomId가 바뀌면(재대결 등) 이전 방의 메시지가 잠깐 남아 보이지 않도록 비운다
    queueMicrotask(() => {
      if (!cancelled) setMessages([]);
    });

    loadChatMessages(supabase, roomId)
      .then((msgs) => {
        if (!cancelled) setMessages(msgs);
      })
      .catch(() => {
        // 테이블이 아직 없거나(마이그레이션 미적용) 일시적 오류 — 채팅은 조용히 비활성 상태로 둔다
      });

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = rowToMessage(payload.new as Record<string, unknown>);
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const send = useCallback(
    (text: string) => {
      const supabase = getSupabase();
      if (!supabase || !nickname) return;
      void sendChatMessage(supabase, roomId, myId, nickname, text).catch(() => {
        // 전송 실패는 조용히 무시 — 다음 메시지 전송을 막지 않는다
      });
    },
    [roomId, myId, nickname],
  );

  return { messages, send };
}
