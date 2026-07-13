"use client";

import { useEffect, useState } from "react";
import type { GameType } from "@/lib/gameRules";

/**
 * 이 브라우저에서 해당 게임을 처음 켤 때 규칙 모달을 자동으로 한 번 띄우고,
 * 닫으면(건너뛰기든 확인이든) 다시 자동으로 뜨지 않는다. reopen()으로 언제든 다시 볼 수 있다.
 */
export function useRulesModal(gameType: GameType) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      const key = `rules-seen:${gameType}`;
      if (!cancelled && !window.localStorage.getItem(key)) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [gameType]);

  const close = () => {
    window.localStorage.setItem(`rules-seen:${gameType}`, "1");
    setOpen(false);
  };

  const reopen = () => setOpen(true);

  return { open, close, reopen };
}
