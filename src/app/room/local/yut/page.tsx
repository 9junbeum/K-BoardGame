"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import KakaoAdFit from "@/components/KakaoAdFit";
import RulesModal from "@/components/RulesModal";
import YutBoard, { PLAYER_COLORS } from "@/components/YutBoard";
import {
  applyThrow,
  applyYutMove,
  canApplyResult,
  computeDestination,
  createYutState,
  DEFAULT_YUT_RULES,
  isTurnOver,
  nextPlayer,
  RESULT_STEPS,
  throwSticks,
  YUT_RESULT_LABEL,
  type YutPiece,
  type YutResult,
  type YutRules,
  type YutState,
} from "@/games/yut/logic";
import { saveLocalRecord } from "@/lib/history";
import { useRulesModal } from "@/lib/useRulesModal";

type LocalPlayer = "P1" | "P2";
const ORDER: LocalPlayer[] = ["P1", "P2"];
const PLAYER_LABEL: Record<LocalPlayer, string> = { P1: "플레이어 1", P2: "플레이어 2" };
const PIECE_COUNT_OPTIONS = [2, 3, 4] as const;

export default function LocalYutRoomPage() {
  const [rules, setRules] = useState<YutRules>(DEFAULT_YUT_RULES);
  const [state, setState] = useState<YutState>(() => createYutState(ORDER, DEFAULT_YUT_RULES));
  const [current, setCurrent] = useState<LocalPlayer>("P1");
  const [started, setStarted] = useState(false);
  const [winner, setWinner] = useState<LocalPlayer | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<number | "new" | null>(null);
  const rulesModal = useRulesModal("yut");

  const finished = winner !== null;

  const resolveTurn = useCallback(
    (st: YutState, playerId: LocalPlayer): { state: YutState; next: LocalPlayer } => {
      let s = st;
      if (
        s.throwsLeft <= 0 &&
        s.pending.length > 0 &&
        s.pending.every((r) => !canApplyResult(s, playerId, r))
      ) {
        s = { ...s, pending: [] };
      }
      if (isTurnOver(s)) {
        return { state: { ...s, throwsLeft: 1 }, next: nextPlayer(s, playerId) as LocalPlayer };
      }
      return { state: s, next: playerId };
    },
    [],
  );

  const doThrow = useCallback(() => {
    if (finished || state.throwsLeft <= 0) return;
    const { result, sticks } = throwSticks(rules);
    const st = applyThrow(state, current, result, sticks);
    setStarted(true);
    const r = resolveTurn(st, current);
    setState(r.state);
    setCurrent(r.next);
  }, [finished, state, rules, current, resolveTurn]);

  const applicableResultsFor = useCallback(
    (target: number | "new"): YutResult[] => {
      const mine = state.pieces[current] ?? [];
      const set = new Set<YutResult>();
      for (const r of state.pending) {
        const steps = RESULT_STEPS[r];
        if (target === "new") {
          if (steps > 0 && mine.some((p) => p.pos === "ready")) set.add(r);
        } else {
          const piece = mine.find((p) => typeof p.pos === "number" && p.pos === target);
          if (piece && computeDestination(piece, steps) !== null) set.add(r);
        }
      }
      return [...set];
    },
    [state, current],
  );

  const applyMoveTo = useCallback(
    (target: number | "new", result: YutResult) => {
      setSelectedTarget(null);
      let t: number | "new" = target;
      if (typeof target === "number") {
        const idx = (state.pieces[current] ?? []).findIndex(
          (p) => typeof p.pos === "number" && p.pos === target,
        );
        if (idx === -1) return;
        t = idx;
      }
      const r = applyYutMove(state, current, t, result);
      if (!r) return;
      if (r.won) {
        setState(r.state);
        setWinner(current);
        if (!saved) {
          saveLocalRecord({
            roomId: null,
            gameType: "yut",
            result: current === "P1" ? "win" : "lose",
            opponentNickname: "같은 화면 대국",
            moves: null,
          });
          setSaved(true);
        }
        return;
      }
      const resolved = resolveTurn(r.state, current);
      setState(resolved.state);
      setCurrent(resolved.next);
    },
    [state, current, resolveTurn, saved],
  );

  const selectTarget = useCallback(
    (target: number | "new") => {
      if (finished) return;
      if (selectedTarget === target) {
        setSelectedTarget(null);
        return;
      }
      const results = applicableResultsFor(target);
      if (results.length === 0) return;
      if (results.length === 1) {
        applyMoveTo(target, results[0]);
        return;
      }
      setSelectedTarget(target);
    },
    [finished, selectedTarget, applicableResultsFor, applyMoveTo],
  );

  const destNodeFor = useCallback(
    (target: number | "new", result: YutResult): number | null => {
      const piece: YutPiece | undefined =
        target === "new"
          ? { pos: "ready", trail: [] }
          : (state.pieces[current] ?? []).find(
              (p) => typeof p.pos === "number" && p.pos === target,
            );
      if (!piece) return null;
      const dest = computeDestination(piece, RESULT_STEPS[result]);
      if (!dest) return null;
      return dest.pos === "done" ? 0 : dest.pos;
    },
    [state, current],
  );

  const moveTargetResults = useMemo(() => {
    const map = new Map<number, YutResult>();
    if (selectedTarget === null) return map;
    for (const r of applicableResultsFor(selectedTarget)) {
      const node = destNodeFor(selectedTarget, r);
      if (node !== null) map.set(node, r);
    }
    return map;
  }, [selectedTarget, applicableResultsFor, destNodeFor]);

  const moveTargetLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const [node, r] of moveTargetResults) map.set(node, YUT_RESULT_LABEL[r]);
    return map;
  }, [moveTargetResults]);

  const handleMoveTargetClick = useCallback(
    (node: number) => {
      if (selectedTarget === null) return;
      const r = moveTargetResults.get(node);
      if (!r) return;
      applyMoveTo(selectedTarget, r);
    },
    [selectedTarget, moveTargetResults, applyMoveTo],
  );

  const setRule = useCallback(
    (next: YutRules) => {
      setRules(next);
      setState(createYutState(ORDER, next));
      setCurrent("P1");
      setWinner(null);
      setSaved(false);
      setSelectedTarget(null);
    },
    [],
  );

  const reset = useCallback(() => {
    setState(createYutState(ORDER, rules));
    setCurrent("P1");
    setStarted(false);
    setWinner(null);
    setSaved(false);
    setSelectedTarget(null);
  }, [rules]);

  const myPieces = state.pieces[current] ?? [];
  const selectableNodes = new Set<number>();
  if (!finished && state.pending.length > 0) {
    for (const p of myPieces) {
      if (typeof p.pos !== "number") continue;
      if (applicableResultsFor(p.pos).length > 0) selectableNodes.add(p.pos);
    }
  }
  const newPieceResults = !finished ? applicableResultsFor("new") : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center px-4 py-6">
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
          <span>말 개수</span>
          {PIECE_COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setRule({ ...rules, pieceCount: n })}
              disabled={started}
              className={`rounded border px-2.5 py-1 transition disabled:opacity-40 ${
                rules.pieceCount === n
                  ? "border-vermil bg-paper-deep text-ink"
                  : "border-mud/40 hover:border-ink"
              }`}
            >
              {n}개
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={rules.backdo}
            disabled={started}
            onChange={(e) => setRule({ ...rules, backdo: e.target.checked })}
            className="h-4 w-4 accent-[#8b2a1f] disabled:opacity-40"
          />
          빽도 사용
        </label>
      </div>

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-center">
        {/* 왼쪽: 윷 던지기 연출 */}
        <aside className="w-full lg:w-56 lg:shrink-0 lg:pt-8">
          {state.lastThrow ? (
            <div
              key={state.lastThrow.at}
              className="stick-area banner-in flex flex-row items-center justify-center gap-5 rounded-lg border border-mud/30 bg-paper-deep px-4 py-4 lg:flex-col lg:py-8"
            >
              <div className="flex gap-2.5">
                {state.lastThrow.sticks.map((flat, i) => (
                  <span
                    key={i}
                    className={`stick stick-lg stick-toss ${flat ? "stick-flat" : "stick-round"} ${
                      flat && i === 0 && rules.backdo ? "stick-mark" : ""
                    }`}
                    style={{ animationDelay: `${i * 70}ms` }}
                    title={flat ? "배" : "등"}
                  />
                ))}
              </div>
              <div className="throw-label text-center">
                <p
                  className={`text-4xl font-bold ${
                    state.lastThrow.result === "nak" ? "text-mud" : "text-vermil"
                  }`}
                >
                  {YUT_RESULT_LABEL[state.lastThrow.result]}
                  {state.lastThrow.result === "nak" ? "!" : ""}
                </p>
                {state.lastThrow.result === "nak" && (
                  <p className="mt-0.5 font-plex text-[10px] text-mud">이번 던지기는 무효입니다</p>
                )}
                <p className="mt-1 font-plex text-[11px] text-mud">
                  {PLAYER_LABEL[state.lastThrow.by as LocalPlayer]}
                </p>
              </div>
            </div>
          ) : (
            <div className="hidden rounded-lg border border-dashed border-mud/30 px-4 py-10 text-center font-plex text-xs text-mud lg:block">
              윷을 던지면
              <br />
              여기에 결과가 나옵니다
            </div>
          )}
        </aside>

        {/* 중앙: 보드 + 조작 */}
        <div className="flex w-full max-w-[558px] flex-col items-center lg:shrink-0">
          <YutBoard
            pieces={state.pieces}
            order={ORDER}
            selectableNodes={selectedTarget === null ? selectableNodes : new Set<number>()}
            selectedNode={typeof selectedTarget === "number" ? selectedTarget : null}
            moveTargets={moveTargetLabels}
            onNodeClick={(node) => selectTarget(node)}
            onMoveTargetClick={handleMoveTargetClick}
          />

          <div className="mt-4 w-full">
            {!finished && (
              <div className="text-center">
                <p className="font-plex text-xs text-mud">
                  {PLAYER_LABEL[current]}의 차례입니다
                </p>

                <div className="banner-in mt-2 rounded-lg border border-vermil/40 bg-paper-deep px-4 py-3">
                  {state.throwsLeft > 0 && (
                    <button
                      onClick={doThrow}
                      className="rounded bg-vermil px-8 py-2.5 text-lg text-paper shadow transition hover:opacity-85"
                    >
                      윷 던지기{state.throwsLeft > 1 ? ` ×${state.throwsLeft}` : ""}
                    </button>
                  )}

                  {state.pending.length > 0 && (
                    <div className="mt-3">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <span className="font-plex text-[11px] text-mud">남은 결과</span>
                        {state.pending.map((r, i) => (
                          <span
                            key={`${r}-${i}`}
                            className="rounded-full border border-mud/40 px-3 py-1 text-sm text-ink-soft"
                          >
                            {YUT_RESULT_LABEL[r]}
                            <span className="ml-1 font-plex text-[10px] opacity-70">
                              {RESULT_STEPS[r] > 0 ? `+${RESULT_STEPS[r]}` : "-1"}
                            </span>
                          </span>
                        ))}
                      </div>

                      {selectedTarget === null && (
                        <p className="mt-2 font-plex text-[11px] text-mud">
                          판 위의 점선 표시된 말을 클릭하거나, 오른쪽 대기 말을 눌러 새 말을
                          투입하세요
                        </p>
                      )}

                      {selectedTarget !== null && moveTargetLabels.size > 0 && (
                        <div className="banner-in mt-2 flex flex-col items-center gap-1.5">
                          <p className="font-plex text-[11px] text-mud">
                            판 위에 초록색으로 표시된 칸을 클릭해서 이동하세요
                          </p>
                          <button
                            onClick={() => setSelectedTarget(null)}
                            className="rounded-full border border-mud/40 px-4 py-1.5 text-xs text-ink-soft transition hover:border-ink"
                          >
                            선택 취소
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {finished && (
              <div className="banner-in rounded-lg border border-vermil/50 bg-paper-deep px-6 py-4 text-center shadow">
                <p className="text-xl font-semibold">{PLAYER_LABEL[winner!]} 승리</p>
                <p className="mt-1 font-plex text-xs text-mud">
                  모든 말 완주 · 기록이 이 브라우저에 저장되었습니다
                </p>
                <button
                  onClick={reset}
                  className="mt-3 rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft"
                >
                  한 판 더
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 플레이어별 말 현황 */}
        <aside className="w-full lg:w-56 lg:shrink-0 lg:pt-8">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {ORDER.map((p, i) => {
              const isTurn = !finished && current === p;
              const pcs = state.pieces[p] ?? [];
              const ready = pcs.filter((x) => x.pos === "ready").length;
              const done = pcs.filter((x) => x.pos === "done").length;
              return (
                <div
                  key={p}
                  className={`rounded-lg border px-3 py-2.5 transition ${
                    isTurn ? "border-vermil bg-paper-deep shadow" : "border-mud/30"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PLAYER_COLORS[i] }}
                    />
                    <p className="truncate text-sm font-semibold">{PLAYER_LABEL[p]}</p>
                    {isTurn && <span className="ml-auto font-plex text-[10px] text-vermil">차례</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {pcs.map((pc, pi) => {
                      const mine = p === current && !finished;
                      const clickable = mine && pc.pos === "ready" && newPieceResults.length > 0;
                      return (
                        <span
                          key={pi}
                          onClick={clickable ? () => selectTarget("new") : undefined}
                          title={
                            pc.pos === "done"
                              ? "완주"
                              : pc.pos === "ready"
                                ? clickable
                                  ? "클릭해서 새 말 투입"
                                  : "대기"
                                : "판 위"
                          }
                          className={`inline-block rounded-full border-2 transition ${
                            mine ? "h-6 w-6" : "h-4 w-4"
                          } ${
                            clickable
                              ? "cursor-pointer hover:scale-110" +
                                (selectedTarget === "new" ? " ring-2 ring-vermil" : " ring-2 ring-vermil/40")
                              : ""
                          }`}
                          style={{
                            borderColor: PLAYER_COLORS[i],
                            backgroundColor: pc.pos === "ready" ? "transparent" : PLAYER_COLORS[i],
                            opacity: pc.pos === "done" ? 0.35 : 1,
                          }}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-1.5 font-plex text-[10px] text-mud">
                    대기 {ready} · 판 위 {rules.pieceCount - ready - done} · 완주 {done}/
                    {rules.pieceCount}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 hidden font-plex text-[10px] text-mud lg:block">
            ○ 대기 · ● 판 위 · 흐림 완주 — 차례인 플레이어의 대기 말을 클릭해 새 말 투입
          </p>
        </aside>
      </div>

      <p className="mt-6 font-plex text-xs text-mud">
        한 화면에서 플레이어 1과 플레이어 2가 번갈아 윷을 던집니다.
      </p>

      <div className="mt-8 w-full max-w-2xl">
        <KakaoAdFit adUnit="DAN-DXVo1uxzwvIXqjLT" width={320} height={100} />
      </div>

      <RulesModal open={rulesModal.open} gameType="yut" onClose={rulesModal.close} />
    </main>
  );
}
