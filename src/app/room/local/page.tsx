"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Board from "@/components/Board";
import KakaoAdFit from "@/components/KakaoAdFit";
import RulesModal from "@/components/RulesModal";
import {
  applyMove,
  boardFromMoves,
  DEFAULT_RULES,
  isForbiddenMove,
  nextColor,
  type GameState,
  type StoneColor,
  type WinResult,
} from "@/games/omok/logic";
import { saveLocalRecord } from "@/lib/history";
import { useRulesModal } from "@/lib/useRulesModal";

const COLOR_LABEL = { b: "흑", w: "백" } as const;

export default function LocalRoomPage() {
  const [state, setState] = useState<GameState>({ moves: [] });
  const [win, setWin] = useState<WinResult | null>(null);
  const [draw, setDraw] = useState(false);
  const [saved, setSaved] = useState(false);
  const [forbidDoubleThree, setForbidDoubleThree] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [undoUsed, setUndoUsed] = useState<Record<StoneColor, boolean>>({ b: false, w: false });
  const rulesModal = useRulesModal("omok");

  const board = useMemo(() => boardFromMoves(state.moves), [state.moves]);
  const lastMove = state.moves.at(-1) ?? null;
  const turn = nextColor(state.moves);
  const finished = Boolean(win) || draw;

  const rules = useMemo(
    () => ({ ...DEFAULT_RULES, forbidDoubleThree }),
    [forbidDoubleThree],
  );

  const place = useCallback(
    (x: number, y: number) => {
      if (finished) return;
      if (isForbiddenMove(state, x, y, rules)) {
        setMoveError("삼삼(3×3) 금지 — 열린 3이 두 개 생기는 자리입니다.");
        setTimeout(() => setMoveError(null), 2200);
        return;
      }
      const r = applyMove(state, x, y, rules);
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
    [state, finished, saved, rules],
  );

  const lastColor = state.moves.at(-1)?.c ?? null;
  const canUndo = !finished && lastColor !== null && !undoUsed[lastColor];

  const undoMove = useCallback(() => {
    if (!canUndo || !lastColor) return;
    setState((prev) => ({ moves: prev.moves.slice(0, -1) }));
    setUndoUsed((prev) => ({ ...prev, [lastColor]: true }));
  }, [canUndo, lastColor]);

  const reset = useCallback(() => {
    setState({ moves: [] });
    setWin(null);
    setDraw(false);
    setSaved(false);
    setUndoUsed({ b: false, w: false });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center px-4 py-6">
      <div className="mb-4 w-full">
        <KakaoAdFit adUnit="DAN-DXVo1uxzwvIXqjLT" width={320} height={100} />
      </div>

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

      <div className="mb-3 flex items-center gap-4">
        <label className="flex cursor-pointer items-center gap-1.5 font-plex text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={forbidDoubleThree}
            disabled={state.moves.length > 0}
            onChange={(e) => setForbidDoubleThree(e.target.checked)}
            className="h-4 w-4 accent-[#8b2a1f]"
          />
          삼삼 금지
        </label>
        <button
          onClick={undoMove}
          disabled={!canUndo}
          className="rounded border border-mud/40 px-3 py-1 font-plex text-xs text-ink-soft transition hover:border-ink disabled:opacity-40"
        >
          무르기 ({COLOR_LABEL[lastColor ?? turn]} 1회)
        </button>
      </div>

      <Board
        board={board}
        lastMove={lastMove}
        winLine={win?.line ?? null}
        previewColor={finished ? null : turn}
        onPlace={place}
      />

      {moveError && (
        <p className="banner-in mt-3 font-plex text-xs text-vermil">{moveError}</p>
      )}

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

      <RulesModal open={rulesModal.open} gameType="omok" onClose={rulesModal.close} />
    </main>
  );
}
