"use client";

import { useEffect, useRef } from "react";

function beep() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    // Web Audio를 지원하지 않는 환경 — 조용히 무시
  }
}

/**
 * 내 차례가 되는 순간 탭이 백그라운드(hidden)라면 짧은 알림음을 울리고,
 * 탭 제목을 깜빡여 알려준다. 탭으로 돌아오면 원래 제목으로 즉시 복원된다.
 */
export function useTurnNotification(myTurn: boolean) {
  const prevTurn = useRef(myTurn);
  const flashId = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitle = useRef<string | null>(null);

  useEffect(() => {
    const stopFlash = () => {
      if (flashId.current) {
        clearInterval(flashId.current);
        flashId.current = null;
      }
      if (originalTitle.current !== null) {
        document.title = originalTitle.current;
        originalTitle.current = null;
      }
    };

    const becameMyTurn = myTurn && !prevTurn.current;
    prevTurn.current = myTurn;

    if (becameMyTurn && document.hidden) {
      beep();
      originalTitle.current = document.title;
      let flipped = false;
      flashId.current = setInterval(() => {
        flipped = !flipped;
        document.title = flipped ? "🔴 당신 차례입니다!" : (originalTitle.current ?? document.title);
      }, 1000);
    }

    if (!myTurn) stopFlash();

    const onVisibilityChange = () => {
      if (!document.hidden) stopFlash();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [myTurn]);

  useEffect(() => {
    return () => {
      if (flashId.current) clearInterval(flashId.current);
      if (originalTitle.current !== null) document.title = originalTitle.current;
    };
  }, []);
}
