"use client";

import { useEffect, useState } from "react";
import type { LastReveal } from "@/games/memory/logic";

interface MemoryBoardProps {
  deck: string[];
  cols: number;
  matched: number[];
  revealed: number[];
  lastReveal: LastReveal | null;
  /** 지금 내가 카드를 고를 수 있는지 */
  interactive: boolean;
  onPick: (index: number) => void;
}

/** 방금 판정된 두 장을 잠깐 더 보여주는 시간(ms) — 결과를 눈으로 확인할 시간을 준다 */
const REVEAL_FLASH_MS = 1100;

export default function MemoryBoard({
  deck,
  cols,
  matched,
  revealed,
  lastReveal,
  interactive,
  onPick,
}: MemoryBoardProps) {
  // lastReveal은 realtime으로 매번 새로 JSON 파싱되어 오므로 객체 참조는 매 업데이트마다 바뀐다.
  // 참조 대신 실제로 값이 바뀌었는지 구분할 수 있는 lastReveal.at(타임스탬프)을 키로 써야
  // "새 판정이 실제로 일어났을 때만" 플래시가 켜진다 — 그렇지 않으면 상대가 아무 카드나
  // 눌러도(=관련 없는 업데이트) 직전에 틀렸던 카드 쌍이 다시 반짝이며 나타나는 오류가 생긴다.
  const lastRevealKey = lastReveal?.at ?? null;
  const [showFlash, setShowFlash] = useState(false);
  const [prevKey, setPrevKey] = useState(lastRevealKey);
  if (prevKey !== lastRevealKey) {
    setPrevKey(lastRevealKey);
    setShowFlash(Boolean(lastReveal));
  }

  useEffect(() => {
    if (!showFlash) return;
    const t = setTimeout(() => setShowFlash(false), REVEAL_FLASH_MS);
    return () => clearTimeout(t);
  }, [showFlash, lastRevealKey]);

  const matchedSet = new Set(matched);
  const revealedSet = new Set(revealed);
  const flashSet =
    showFlash && lastReveal ? new Set([lastReveal.a, lastReveal.b]) : new Set<number>();

  return (
    <div
      className="grid w-full max-w-[560px] gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {deck.map((symbol, i) => {
        const isMatched = matchedSet.has(i);
        const isRevealed = revealedSet.has(i);
        const isFlash = flashSet.has(i);
        const faceUp = isMatched || isRevealed || isFlash;
        const mismatchFlash = isFlash && lastReveal && !lastReveal.matchedNow;
        const clickable = interactive && !isMatched && !faceUp && !showFlash;

        return (
          <button
            key={i}
            onClick={() => clickable && onPick(i)}
            disabled={!clickable}
            className={`flex aspect-square items-center justify-center rounded-lg border text-2xl transition sm:text-3xl ${
              faceUp
                ? isMatched
                  ? "border-mud/30 bg-paper-deep opacity-60"
                  : mismatchFlash
                    ? "banner-in border-vermil bg-paper-deep shadow"
                    : "banner-in border-vermil/60 bg-paper-deep shadow"
                : "border-mud/40 bg-ink text-paper shadow-inner"
            } ${clickable ? "cursor-pointer hover:border-ink hover:shadow" : ""}`}
            aria-label={faceUp ? symbol : "뒤집힌 카드"}
          >
            {faceUp ? symbol : <span className="font-plex text-sm opacity-50">?</span>}
          </button>
        );
      })}
    </div>
  );
}
