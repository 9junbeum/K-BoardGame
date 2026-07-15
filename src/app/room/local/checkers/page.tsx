"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import CheckersBoard from "@/components/CheckersBoard";
import KakaoAdFit from "@/components/KakaoAdFit";
import RulesModal from "@/components/RulesModal";
import {
  applyPath,
  createCheckersState,
  deriveCheckers,
  type GameState,
  type Point,
} from "@/games/checkers/logic";
import { saveLocalRecord } from "@/lib/history";
import { useRulesModal } from "@/lib/useRulesModal";

const COLOR_LABEL = { b: "흑", w: "백" } as const;

export default function LocalCheckersRoomPage() {
  const [state, setState] = useState<GameState>(createCheckersState());
  const [saved, setSaved] = useState(false);
  const rulesModal = useRulesModal("checkers");

  const derived = useMemo(() => deriveCheckers(state.moves), [state.moves]);
  const finished = derived.gameOver;

  const move = useCallback(
    (path: Point[]) => {
      if (finished) return;
      const r = applyPath(state, derived.toMove, path);
      if (!r) return;
      setState(r.state);
      const d = deriveCheckers(r.state.moves);
      if (d.gameOver && !saved) {
        saveLocalRecord({
          roomId: null,
          gameType: "checkers",
          result: d.winner === "b" ? "win" : "lose",
          opponentNickname: "같은 화면 대국",
          moves: r.state.moves,
        });
        setSaved(true);
      }
    },
    [state, derived.toMove, finished, saved],
  );

  const reset = useCallback(() => {
    setState(createCheckersState());
    setSaved(false);
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

      {/* 턴/말 수 표시 */}
      <div className="mb-4 flex gap-3">
        {(["b", "w"] as const).map((c) => (
          <div
            key={c}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 transition ${
              !finished && derived.toMove === c
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
            <span className="font-plex text-[10px] text-mud">말 {derived.counts[c]}</span>
          </div>
        ))}
      </div>

      {!finished && derived.forcedCapture && (
        <p className="mb-3 font-plex text-xs text-vermil">
          잡을 수 있는 말이 있으면 반드시 잡아야 합니다 (강제 잡기)
        </p>
      )}

      <CheckersBoard
        board={derived.board}
        legalStarts={finished ? [] : derived.legalStarts}
        interactive={!finished}
        onMove={move}
      />

      {finished && (
        <div className="banner-in mt-5 w-full max-w-[520px] rounded-lg border border-vermil/50 bg-paper-deep px-6 py-4 text-center shadow">
          <p className="text-xl font-semibold">
            {derived.winner ? `${COLOR_LABEL[derived.winner]} 승리` : "종료"}
          </p>
          <p className="mt-1 font-plex text-xs text-mud">
            흑 {derived.counts.b} : 백 {derived.counts.w} · 기록이 이 브라우저에 저장되었습니다
          </p>
          <button
            onClick={reset}
            className="mt-3 rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft"
          >
            한 판 더
          </button>
        </div>
      )}

      <p className="mt-6 font-plex text-xs text-mud">한 화면에서 흑과 백을 번갈아 둡니다.</p>

      <RulesModal open={rulesModal.open} gameType="checkers" onClose={rulesModal.close} />
    </main>
  );
}
