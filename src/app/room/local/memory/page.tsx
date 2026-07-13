"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import KakaoAdFit from "@/components/KakaoAdFit";
import MemoryBoard from "@/components/MemoryBoard";
import RulesModal from "@/components/RulesModal";
import {
  createMemoryState,
  DEFAULT_MEMORY_RULES,
  GRID_DIMS,
  GRID_SIZES,
  pickCard,
  timeoutTurn,
  TURN_SECONDS_OPTIONS,
  type GridSize,
  type MemoryState,
} from "@/games/memory/logic";
import { saveLocalRecord } from "@/lib/history";
import { useRulesModal } from "@/lib/useRulesModal";

type LocalPlayer = "P1" | "P2";
const PLAYERS: LocalPlayer[] = ["P1", "P2"];
const PLAYER_LABEL: Record<LocalPlayer, string> = { P1: "플레이어 1", P2: "플레이어 2" };

export default function LocalMemoryRoomPage() {
  const [grid, setGrid] = useState<GridSize>(DEFAULT_MEMORY_RULES.grid);
  const [turnSeconds, setTurnSeconds] = useState(DEFAULT_MEMORY_RULES.turnSeconds);
  const [state, setState] = useState<MemoryState>(() => createMemoryState(grid, turnSeconds));
  const [turn, setTurn] = useState<LocalPlayer>("P1");
  const [started, setStarted] = useState(false);
  const [saved, setSaved] = useState(false);
  const rulesModal = useRulesModal("memory");

  const { rows, cols } = GRID_DIMS[grid];
  const gameOver = state.matched.length === state.deck.length;

  const pick = useCallback(
    (i: number) => {
      const r = pickCard(state, i, turn, turnSeconds);
      if (!r) return;
      setStarted(true);
      setState(r.state);
      if (r.gameOver) {
        const p1 = r.state.scores.P1 ?? 0;
        const p2 = r.state.scores.P2 ?? 0;
        if (!saved) {
          saveLocalRecord({
            roomId: null,
            gameType: "memory",
            result: p1 === p2 ? "draw" : p1 > p2 ? "win" : "lose",
            opponentNickname: "같은 화면 대국",
            moves: null,
          });
          setSaved(true);
        }
      } else if (r.turnEnded) {
        setTurn((prev) => (prev === "P1" ? "P2" : "P1"));
      }
    },
    [state, turn, turnSeconds, saved],
  );

  // ---------- 턴 제한 시간 ----------
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!started || gameOver) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= new Date(stateRef.current.deadline).getTime()) {
        setState((prev) => timeoutTurn(prev, turnSeconds));
        setTurn((prev) => (prev === "P1" ? "P2" : "P1"));
      }
    }, 300);
    return () => clearInterval(id);
  }, [started, gameOver, turnSeconds]);

  const secondsLeft = now
    ? Math.max(0, Math.ceil((new Date(state.deadline).getTime() - now) / 1000))
    : turnSeconds;

  const reset = useCallback(() => {
    setState(createMemoryState(grid, turnSeconds));
    setTurn("P1");
    setStarted(false);
    setSaved(false);
  }, [grid, turnSeconds]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center px-4 py-6">
      <header className="mb-4 flex w-full items-center justify-between">
        <Link
          href="/"
          className="font-plex text-xs text-mud underline-offset-4 transition hover:text-ink hover:underline"
        >
          ← 로비로
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-plex text-[10px] uppercase tracking-widest text-mud">
            local · same screen
          </span>
          <button
            onClick={rulesModal.reopen}
            className="rounded border border-mud/40 px-3 py-1 font-plex text-xs text-ink-soft transition hover:border-ink"
          >
            규칙 보기
          </button>
        </div>
      </header>

      {/* 설정 (시작 전에만 변경 가능) */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-3 font-plex text-xs text-ink-soft">
        <div className="flex items-center gap-1.5">
          <span>배열</span>
          {GRID_SIZES.map((g) => (
            <button
              key={g}
              onClick={() => {
                setGrid(g);
                setState(createMemoryState(g, turnSeconds));
              }}
              disabled={started}
              className={`rounded border px-2.5 py-1 transition disabled:opacity-40 ${
                grid === g ? "border-vermil bg-paper-deep text-ink" : "border-mud/40 hover:border-ink"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span>턴 제한</span>
          {TURN_SECONDS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setTurnSeconds(s);
                setState(createMemoryState(grid, s));
              }}
              disabled={started}
              className={`rounded border px-2.5 py-1 transition disabled:opacity-40 ${
                turnSeconds === s ? "border-vermil bg-paper-deep text-ink" : "border-mud/40 hover:border-ink"
              }`}
            >
              {s}초
            </button>
          ))}
        </div>
      </div>

      {/* 플레이어 패널 */}
      <div className="mb-4 flex w-full max-w-[560px] items-center justify-between gap-2">
        {PLAYERS.map((p) => {
          const isTurn = !gameOver && turn === p;
          const score = state.scores[p] ?? 0;
          return (
            <div
              key={p}
              className={`flex flex-1 items-center gap-2 rounded-lg border px-4 py-2.5 transition ${
                isTurn ? "border-vermil bg-paper-deep shadow" : "border-mud/30"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{PLAYER_LABEL[p]}</p>
                <p className="font-plex text-[10px] text-mud">
                  맞춘 짝 {score}
                  {isTurn ? ` · 차례 (${secondsLeft}초)` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <MemoryBoard
        deck={state.deck}
        cols={cols}
        matched={state.matched}
        revealed={state.revealed}
        lastReveal={state.lastReveal}
        interactive={!gameOver}
        onPick={pick}
      />
      <p className="mt-1 font-plex text-[10px] text-mud">
        {rows}×{cols} 배열 · 총 {(rows * cols) / 2}쌍
      </p>

      {gameOver && (
        <div className="banner-in mt-5 w-full max-w-[560px] rounded-lg border border-vermil/50 bg-paper-deep px-6 py-4 text-center shadow">
          <p className="text-xl font-semibold">
            {(state.scores.P1 ?? 0) === (state.scores.P2 ?? 0)
              ? "무승부"
              : `${PLAYER_LABEL[(state.scores.P1 ?? 0) > (state.scores.P2 ?? 0) ? "P1" : "P2"]} 승리`}
          </p>
          <p className="mt-1 font-plex text-xs text-mud">
            {PLAYER_LABEL.P1} {state.scores.P1 ?? 0} · {PLAYER_LABEL.P2} {state.scores.P2 ?? 0} · 기록이 이
            브라우저에 저장되었습니다
          </p>
          <button
            onClick={reset}
            className="mt-3 rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft"
          >
            한 판 더
          </button>
        </div>
      )}

      <p className="mt-6 font-plex text-xs text-mud">
        한 화면에서 플레이어 1과 플레이어 2가 번갈아 카드를 고릅니다.
      </p>

      <div className="mt-8 w-full max-w-2xl">
        <KakaoAdFit adUnit="DAN-DXVo1uxzwvIXqjLT" width={320} height={100} />
      </div>

      <RulesModal open={rulesModal.open} gameType="memory" onClose={rulesModal.close} />
    </main>
  );
}
