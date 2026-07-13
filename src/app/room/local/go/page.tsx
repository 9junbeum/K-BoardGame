"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import GoBoard from "@/components/GoBoard";
import KakaoAdFit from "@/components/KakaoAdFit";
import RulesModal from "@/components/RulesModal";
import {
  applyPass,
  applyPlace,
  computeScore,
  createGoState,
  deriveGo,
  toggleDeadGroup,
  isDoublePass,
  type BoardSize,
  type GoScore,
  type GoState,
} from "@/games/go/logic";
import { saveLocalRecord } from "@/lib/history";
import { useRulesModal } from "@/lib/useRulesModal";

const KOMI = 6.5;
const BOARD_SIZES: BoardSize[] = [9, 13, 19];
const COLOR_LABEL = { b: "흑", w: "백" } as const;

export default function LocalGoRoomPage() {
  const [boardSize, setBoardSize] = useState<BoardSize>(9);
  const [goState, setGoState] = useState<GoState>(createGoState());
  const [phase, setPhase] = useState<"playing" | "scoring" | "finished">("playing");
  const [result, setResult] = useState<GoScore | null>(null);
  const [saved, setSaved] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const rulesModal = useRulesModal("go");

  const derived = useMemo(() => deriveGo(goState.moves, boardSize), [goState.moves, boardSize]);
  const board = derived.board;
  const lastMove = derived.lastAction?.type === "place" ? derived.lastAction : null;

  const place = useCallback(
    (x: number, y: number) => {
      if (phase !== "playing") return;
      const r = applyPlace(goState.moves, boardSize, x, y);
      if (!r) {
        setMoveError("이 자리에는 둘 수 없습니다 — 자충수 또는 패 규칙 위반입니다.");
        setTimeout(() => setMoveError(null), 2200);
        return;
      }
      setGoState((prev) => ({ ...prev, moves: r.moves, scoring: null }));
    },
    [goState.moves, boardSize, phase],
  );

  const pass = useCallback(() => {
    if (phase !== "playing") return;
    const r = applyPass(goState.moves);
    if (isDoublePass(r.moves)) {
      setGoState((prev) => ({ ...prev, moves: r.moves, scoring: { dead: [], confirmedBy: [] } }));
      setPhase("scoring");
    } else {
      setGoState((prev) => ({ ...prev, moves: r.moves, scoring: null }));
    }
  }, [goState.moves, phase]);

  const toggleDead = useCallback(
    (pos: number) => {
      if (phase !== "scoring") return;
      setGoState((prev) => {
        const dead = toggleDeadGroup(board, boardSize, prev.scoring?.dead ?? [], pos);
        return { ...prev, scoring: { dead, confirmedBy: [] } };
      });
    },
    [phase, board, boardSize],
  );

  const resumeFromScoring = useCallback(() => {
    setPhase("playing");
  }, []);

  const confirmScoring = useCallback(() => {
    const dead = goState.scoring?.dead ?? [];
    const score = computeScore(board, boardSize, dead, derived.captures, KOMI);
    setResult(score);
    setPhase("finished");
    if (!saved) {
      saveLocalRecord({
        roomId: null,
        gameType: "go",
        result: score.winner === "draw" ? "draw" : score.winner === "b" ? "win" : "lose",
        opponentNickname: "같은 화면 대국",
        moves: goState.moves,
      });
      setSaved(true);
    }
  }, [goState.scoring, goState.moves, board, boardSize, derived.captures, saved]);

  const reset = useCallback(() => {
    setGoState(createGoState());
    setPhase("playing");
    setResult(null);
    setSaved(false);
  }, []);

  const dead = new Set(goState.scoring?.dead ?? []);

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

      {/* 턴 표시 */}
      <div className="mb-4 flex gap-3">
        {(["b", "w"] as const).map((c) => (
          <div
            key={c}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 transition ${
              phase === "playing" && derived.toMove === c
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
            <span className="font-plex text-[10px] text-mud">잡은 돌 {derived.captures[c]}</span>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2 font-plex text-xs text-ink-soft">
        <span>판 크기</span>
        {BOARD_SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setBoardSize(s)}
            disabled={goState.moves.length > 0}
            className={`rounded border px-3 py-1 transition disabled:opacity-40 ${
              boardSize === s ? "border-vermil bg-paper-deep text-ink" : "border-mud/40 hover:border-ink"
            }`}
          >
            {s}×{s}
          </button>
        ))}
        {phase === "playing" && (
          <button
            onClick={pass}
            className="ml-2 rounded border border-mud/40 px-3 py-1 transition hover:border-ink"
          >
            패스
          </button>
        )}
      </div>

      <GoBoard
        board={board}
        size={boardSize}
        lastMove={lastMove}
        previewColor={phase === "playing" ? derived.toMove : null}
        onPlace={place}
        deadMode={phase === "scoring"}
        deadSet={dead}
        onToggleDead={toggleDead}
      />

      {moveError && (
        <p className="banner-in mt-3 font-plex text-xs text-vermil">{moveError}</p>
      )}

      {phase === "scoring" && (
        <div className="banner-in mt-5 w-full max-w-[560px] rounded-lg border border-mud/30 bg-paper-deep px-6 py-4 text-center">
          <p className="font-semibold">계가 단계입니다</p>
          <p className="mt-1 font-plex text-xs text-mud">
            양쪽 모두 패스해서 대국이 끝났습니다. 죽은 돌을 클릭해 표시하세요 —
            돌을 누르면 연결된 그룹 전체가 함께 표시됩니다.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <button
              onClick={confirmScoring}
              className="rounded bg-vermil px-5 py-1.5 text-sm text-paper transition hover:opacity-85"
            >
              이대로 확정
            </button>
            <button
              onClick={resumeFromScoring}
              className="rounded border border-mud/40 px-5 py-1.5 text-sm text-ink-soft transition hover:border-ink"
            >
              계속 두기
            </button>
          </div>
        </div>
      )}

      {phase === "finished" && result && (
        <div className="banner-in mt-5 w-full max-w-[560px] rounded-lg border border-vermil/50 bg-paper-deep px-6 py-4 text-center shadow">
          <p className="text-xl font-semibold">
            {result.winner === "draw" ? "무승부" : `${COLOR_LABEL[result.winner]} 승리`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-left font-plex text-xs">
            {(["b", "w"] as const).map((c) => (
              <div key={c} className="rounded border border-mud/30 px-3 py-2">
                <p className="font-semibold text-ink-soft">
                  {COLOR_LABEL[c]}
                  {c === "w" ? ` (덤 +${KOMI})` : ""}
                </p>
                <p className="mt-1 text-mud">집 {result.territory[c]}</p>
                <p className="text-mud">포로 {result.captures[c] + result.deadRemoved[c]}</p>
                <p className="mt-1 font-semibold">{result.total[c]}집</p>
              </div>
            ))}
          </div>
          <button
            onClick={reset}
            className="mt-3 rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft"
          >
            한 판 더
          </button>
        </div>
      )}

      <p className="mt-6 font-plex text-xs text-mud">한 화면에서 흑과 백을 번갈아 둡니다.</p>

      <div className="mt-8 w-full max-w-2xl">
        <KakaoAdFit adUnit="DAN-DXVo1uxzwvIXqjLT" width={320} height={100} />
      </div>

      <RulesModal open={rulesModal.open} gameType="go" onClose={rulesModal.close} />
    </main>
  );
}
