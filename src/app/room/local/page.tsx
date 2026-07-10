"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Board from "@/components/Board";
import {
  applyMove,
  boardFromMoves,
  nextColor,
  type GameState,
  type WinResult,
} from "@/games/omok/logic";
import { saveLocalRecord } from "@/lib/history";

const COLOR_LABEL = { b: "흑", w: "백" } as const;

export default function LocalRoomPage() {
  const [state, setState] = useState<GameState>({ moves: [] });
  const [win, setWin] = useState<WinResult | null>(null);
  const [draw, setDraw] = useState(false);
  const [saved, setSaved] = useState(false);

  const board = useMemo(() => boardFromMoves(state.moves), [state.moves]);
  const lastMove = state.moves.at(-1) ?? null;
  const turn = nextColor(state.moves);
  const finished = Boolean(win) || draw;

  const place = useCallback(
    (x: number, y: number) => {
      if (finished) return;
      const r = applyMove(state, x, y);
      if (!r) return;
      setState(r.state);
      if (r.win) setWin(r.win);
      if (r.draw) setDraw(true);
      if ((r.win || r.draw) && !saved) {
        // 같은 화면 대국: 흑 시점으로 기록
        saveLocalRecord({
          roomId: null,
          gameType: "omok",
          result: r.draw ? "draw" : r.win!.color === "b" ? "win" : "lose",
          opponentNickname: "같은 화면 대국",
          moves: r.state.moves,
        });
        setSaved(true);
      }
    },
    [state, finished, saved],
  );

  const reset = useCallback(() => {
    setState({ moves: [] });
    setWin(null);
    setDraw(false);
    setSaved(false);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center px-4 py-6">
      <header className="mb-4 flex w-full items-center justify-between">
        <Link
          href="/"
          className="font-plex text-xs text-mud underline-offset-4 transition hover:text-ink hover:underline"
        >
          ← 로비로
        </Link>
        <span className="font-plex text-[10px] uppercase tracking-widest text-mud">
          local · same screen
        </span>
      </header>

      {/* 턴 표시 */}
      <div className="mb-4 flex gap-3">
        {(["b", "w"] as const).map((c) => (
          <div
            key={c}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 transition ${
              !finished && turn === c
                ? "border-vermil bg-paper-deep shadow"
                : "border-mud/30 opacity-60"
            }`}
          >
            <span
              className={`h-3.5 w-3.5 rounded-full ${
                c === "b" ? "bg-ink" : "border border-mud/60 bg-white"
              }`}
            />
            <span className="text-sm">{COLOR_LABEL[c]}</span>
            {!finished && turn === c && (
              <span className="font-plex text-[10px] text-vermil">차례</span>
            )}
          </div>
        ))}
      </div>

      <Board
        board={board}
        lastMove={lastMove}
        winLine={win?.line ?? null}
        previewColor={finished ? null : turn}
        onPlace={place}
      />

      {finished && (
        <div className="banner-in mt-5 w-full max-w-[590px] rounded-lg border border-vermil/50 bg-paper-deep px-6 py-4 text-center shadow">
          <p className="text-xl font-semibold">
            {draw ? "무승부" : `${COLOR_LABEL[win!.color]} 승리`}
          </p>
          <p className="mt-1 font-plex text-xs text-mud">
            {state.moves.length}수 · 기록이 이 브라우저에 저장되었습니다
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
        한 화면에서 흑과 백을 번갈아 둡니다.
      </p>
    </main>
  );
}
