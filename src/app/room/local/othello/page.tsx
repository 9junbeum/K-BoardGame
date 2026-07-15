"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import KakaoAdFit from "@/components/KakaoAdFit";
import OthelloBoard from "@/components/OthelloBoard";
import RulesModal from "@/components/RulesModal";
import { applyPlace, createOthelloState, deriveOthello, type OthelloState } from "@/games/othello/logic";
import { saveLocalRecord } from "@/lib/history";
import { useRulesModal } from "@/lib/useRulesModal";

const COLOR_LABEL = { b: "흑", w: "백" } as const;

export default function LocalOthelloRoomPage() {
  const [state, setState] = useState<OthelloState>(createOthelloState());
  const [saved, setSaved] = useState(false);
  const rulesModal = useRulesModal("othello");

  const derived = useMemo(() => deriveOthello(state.moves), [state.moves]);
  const lastMove = state.moves.at(-1) ?? null;
  const finished = derived.gameOver;

  const place = useCallback(
    (x: number, y: number) => {
      if (finished) return;
      const r = applyPlace(state.moves, x, y);
      if (!r) return;
      const d = deriveOthello(r.moves);
      setState({ moves: r.moves });
      if (d.gameOver && !saved) {
        const result = d.counts.b === d.counts.w ? "draw" : d.counts.b > d.counts.w ? "win" : "lose";
        saveLocalRecord({
          roomId: null,
          gameType: "othello",
          result,
          opponentNickname: "같은 화면 대국",
          moves: r.moves,
        });
        setSaved(true);
      }
    },
    [state.moves, finished, saved],
  );

  const reset = useCallback(() => {
    setState(createOthelloState());
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

      {/* 턴/점수 표시 */}
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
            <span className="font-plex text-[10px] text-mud">{derived.counts[c]}개</span>
          </div>
        ))}
      </div>

      {!finished && derived.skipped && (
        <p className="mb-3 font-plex text-xs text-vermil">
          둘 곳이 없어 차례가 자동으로 넘어갔습니다.
        </p>
      )}

      <OthelloBoard
        board={derived.board}
        lastMove={lastMove}
        legalMoves={derived.legal}
        previewColor={finished ? null : derived.toMove}
        onPlace={place}
      />

      {finished && (
        <div className="banner-in mt-5 w-full max-w-[560px] rounded-lg border border-vermil/50 bg-paper-deep px-6 py-4 text-center shadow">
          <p className="text-xl font-semibold">
            {derived.counts.b === derived.counts.w
              ? "무승부"
              : `${COLOR_LABEL[derived.counts.b > derived.counts.w ? "b" : "w"]} 승리`}
          </p>
          <p className="mt-1 font-plex text-xs text-mud">
            흑 {derived.counts.b} · 백 {derived.counts.w} · 기록이 이 브라우저에 저장되었습니다
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

      <RulesModal open={rulesModal.open} gameType="othello" onClose={rulesModal.close} />
    </main>
  );
}
