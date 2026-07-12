"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 방에 접속 중인 player_id 집합을 실시간으로 추적한다.
 * 내가 sync에 포함되기 전(아직 접속 신호 전송 전)에는 빈 Set을 반환하므로,
 * 상대방 접속 여부는 반드시 `online.has(myId)`로 동기화 완료를 먼저 확인한 뒤 판단해야 한다.
 */
export function usePresence(
  supabase: SupabaseClient | null,
  roomId: string | undefined,
  myId: string,
): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase || !roomId || !myId) return;

    const channel = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: myId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ online_at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, myId]);

  return online;
}
