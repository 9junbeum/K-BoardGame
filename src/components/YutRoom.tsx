"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import DisconnectBanner from "@/components/DisconnectBanner";
import KakaoAdFit from "@/components/KakaoAdFit";
import NicknameModal from "@/components/NicknameModal";
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
  type YutUndoState,
} from "@/games/yut/logic";
import { saveLocalRecord, saveServerRecord } from "@/lib/history";
import { getPlayerId, getStoredNickname, storeNickname } from "@/lib/player";
import { usePresence } from "@/lib/presence";
import { getSupabase, type PlayerRow } from "@/lib/supabase";
import { useRulesModal } from "@/lib/useRulesModal";
import { useTurnNotification } from "@/lib/useTurnNotification";

const MAX_PLAYERS = 4;

interface YutRoomRow {
  id: string;
  game_type: string;
  status: "waiting" | "playing" | "finished";
  state: YutState | Record<string, never>;
  current_turn: string | null;
  winner: string | null;
  rules: Partial<YutRules> | null;
  undo: YutUndoState | null;
  finished_at: string | null;
}

export default function YutRoom({ roomId }: { roomId: string }) {
  const supabase = useMemo(() => getSupabase(), []);

  const [myId, setMyId] = useState("");
  const [room, setRoom] = useState<YutRoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<number | "new" | null>(null);
  const savedRef = useRef<string | null>(null);
  const rulesModal = useRulesModal("yut");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setMyId(getPlayerId());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchPlayers = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("game_players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    if (data) setPlayers(data as PlayerRow[]);
  }, [supabase, roomId]);

  useEffect(() => {
    if (!supabase || !roomId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setRoom(data as YutRoomRow);
        await fetchPlayers();
      }
      setLoaded(true);
    })();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as YutRoomRow),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_players", filter: `room_id=eq.${roomId}` },
        () => fetchPlayers(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, fetchPlayers]);

  const rules: YutRules = useMemo(
    () => ({ ...DEFAULT_YUT_RULES, ...(room?.rules ?? {}) }),
    [room?.rules],
  );
  const state: YutState | null =
    room && room.state && "order" in room.state ? (room.state as YutState) : null;
  const undo = room?.undo ?? null;

  const me = players.find((p) => p.player_id === myId) ?? null;
  const isHost = players.length > 0 && players[0].player_id === myId;
  const myTurn = room?.status === "playing" && room.current_turn === myId && Boolean(state);
  useTurnNotification(Boolean(myTurn));
  const needJoin =
    loaded &&
    Boolean(room) &&
    myId !== "" &&
    !me &&
    room?.status === "waiting" &&
    players.length < MAX_PLAYERS;

  // 1:1 대국에서만 "상대"가 명확하므로, 접속 끊김 감지도 2인 대국으로 한정한다
  const twoPlayerOpponent = players.length === 2 ? players.find((p) => p.player_id !== myId) ?? null : null;
  const online = usePresence(supabase, roomId, myId);
  const opponentOffline =
    room?.status === "playing" &&
    Boolean(me) &&
    online.has(myId) &&
    Boolean(twoPlayerOpponent && !online.has(twoPlayerOpponent.player_id));

  const forceForfeit = useCallback(async () => {
    if (!supabase || !room || !me) return;
    const update = {
      status: "finished" as const,
      winner: myId,
      current_turn: null as unknown as string,
      finished_at: new Date().toISOString(),
    };
    setRoom((prev) => (prev ? ({ ...prev, ...update } as YutRoomRow) : prev));
    await supabase.from("game_rooms").update(update).eq("id", roomId).eq("status", "playing");
  }, [supabase, room, me, myId, roomId]);

  // ---------- 공통 커밋 (낙관적 반영 + 턴 가드) ----------

  const commit = useCallback(
    async (update: Partial<YutRoomRow>) => {
      if (!supabase || !room) return;
      setRoom((prev) => (prev ? ({ ...prev, ...update } as YutRoomRow) : prev));
      const { data, error } = await supabase
        .from("game_rooms")
        .update(update)
        .eq("id", roomId)
        .eq("current_turn", myId)
        .select("id");
      if (error || !data || data.length === 0) {
        const { data: fresh } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("id", roomId)
          .maybeSingle();
        if (fresh) setRoom(fresh as YutRoomRow);
      }
    },
    [supabase, room, roomId, myId],
  );

  /** 턴 정리: 쓸 수 없는 결과 자동 폐기 → 턴 종료면 다음 사람에게 */
  const resolveTurn = useCallback(
    (st: YutState): Partial<YutRoomRow> => {
      let s = st;
      if (
        s.throwsLeft <= 0 &&
        s.pending.length > 0 &&
        s.pending.every((r) => !canApplyResult(s, myId, r))
      ) {
        s = { ...s, pending: [] };
      }
      if (isTurnOver(s)) {
        return { state: { ...s, throwsLeft: 1 }, current_turn: nextPlayer(s, myId) };
      }
      return { state: s };
    },
    [myId],
  );

  // ---------- 액션 ----------

  const join = useCallback(
    async (nickname: string) => {
      if (!supabase || !room) return;
      storeNickname(nickname);
      const { error } = await supabase.from("game_players").insert({
        room_id: roomId,
        player_id: myId,
        nickname,
        color: String(players.length), // 입장 순서 = 색 번호
      });
      if (error) {
        await fetchPlayers();
        return;
      }
      await fetchPlayers();
    },
    [supabase, room, players, roomId, myId, fetchPlayers],
  );

  const startGame = useCallback(async () => {
    if (!supabase || !room || !isHost || players.length < 2) return;
    const order = players.map((p) => p.player_id);
    const st = createYutState(order, rules);
    setRoom((prev) =>
      prev ? { ...prev, status: "playing", current_turn: order[0], state: st } : prev,
    );
    await supabase
      .from("game_rooms")
      .update({ status: "playing", current_turn: order[0], state: st })
      .eq("id", roomId)
      .eq("status", "waiting");
  }, [supabase, room, isHost, players, rules, roomId]);

  const doThrow = useCallback(async () => {
    if (!myTurn || !state || state.throwsLeft <= 0) return;
    const { result, sticks } = throwSticks(rules);
    const st = applyThrow(state, myId, result, sticks);
    // 던지기가 끼어들면 직전 "말 이동" 무르기는 되돌릴 상태가 어긋나므로 무효화한다
    await commit({ ...resolveTurn(st), undo: { used: undo?.used ?? [] } });
  }, [myTurn, state, rules, myId, commit, resolveTurn, undo]);

  const applyMoveTo = useCallback(
    async (target: number | "new", result: YutResult) => {
      if (!myTurn || !state || !room) return;
      setSelectedTarget(null);
      let t: number | "new" = target;
      if (typeof target === "number") {
        const idx = (state.pieces[myId] ?? []).findIndex(
          (p) => typeof p.pos === "number" && p.pos === target,
        );
        if (idx === -1) return;
        t = idx;
      }
      const r = applyYutMove(state, myId, t, result);
      if (!r) return;
      if (r.won) {
        await commit({
          state: r.state,
          status: "finished",
          winner: myId,
          current_turn: null as unknown as string,
          finished_at: new Date().toISOString(),
          undo: { used: undo?.used ?? [] },
        });
        return;
      }
      // 이번 이동 직전 상태를 무르기용 스냅샷으로 저장 (대기 중이던 신청은 새 이동으로 무효화)
      const snapshot = { state, current_turn: room.current_turn as string, by: myId };
      await commit({ ...resolveTurn(r.state), undo: { used: undo?.used ?? [], snapshot } });
    },
    [myTurn, state, myId, commit, resolveTurn, room, undo],
  );

  // ---------- 무르기 (전원 동의 필요) ----------

  const myUndoUsed = (undo?.used ?? []).includes(myId);
  const canRequestUndo =
    room?.status === "playing" &&
    Boolean(me) &&
    undo?.snapshot?.by === myId &&
    !myUndoUsed &&
    !undo?.by;
  const undoApprovals = undo?.approvals ?? [];
  const othersNeeded = Math.max(players.length - 1, 0);

  const requestUndo = useCallback(async () => {
    if (!supabase || !room || !me || !undo?.snapshot) return;
    const value: YutUndoState = { ...undo, by: myId, approvals: [], declined: undefined };
    setRoom((prev) => (prev ? { ...prev, undo: value } : prev));
    await supabase
      .from("game_rooms")
      .update({ undo: value })
      .eq("id", roomId)
      .eq("status", "playing");
  }, [supabase, room, me, undo, myId, roomId]);

  const approveUndo = useCallback(async () => {
    if (!supabase || !room || !me || !undo?.by || !undo.snapshot) return;
    const approvals = [...new Set([...(undo.approvals ?? []), myId])];
    if (approvals.length >= othersNeeded) {
      // 전원 동의 완료 → 직전 이동을 되돌린다
      const value: YutUndoState = { used: [...(undo.used ?? []), undo.by] };
      const update = { state: undo.snapshot.state, current_turn: undo.snapshot.current_turn, undo: value };
      setRoom((prev) => (prev ? ({ ...prev, ...update } as YutRoomRow) : prev));
      await supabase.from("game_rooms").update(update).eq("id", roomId);
      return;
    }
    const value: YutUndoState = { ...undo, approvals };
    setRoom((prev) => (prev ? { ...prev, undo: value } : prev));
    await supabase.from("game_rooms").update({ undo: value }).eq("id", roomId);
  }, [supabase, room, me, undo, myId, roomId, othersNeeded]);

  const declineUndo = useCallback(async () => {
    if (!supabase || !room || !undo?.by) return;
    const value: YutUndoState = { ...undo, by: undefined, approvals: [], declined: myId };
    setRoom((prev) => (prev ? { ...prev, undo: value } : prev));
    await supabase.from("game_rooms").update({ undo: value }).eq("id", roomId);
  }, [supabase, room, undo, roomId, myId]);

  /** 이 대상(판 위 노드 또는 새 말)에 적용 가능한 결과들 (중복 제거) */
  const applicableResultsFor = useCallback(
    (target: number | "new"): YutResult[] => {
      if (!state) return [];
      const mine = state.pieces[myId] ?? [];
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
    [state, myId],
  );

  /** 말 클릭: 결과가 하나뿐이면 즉시 이동, 여러 개면 이동 가능한 칸을 표시. 같은 말 재클릭 시 선택 취소 */
  const selectTarget = useCallback(
    (target: number | "new") => {
      if (!myTurn) return;
      if (selectedTarget === target) {
        setSelectedTarget(null);
        return;
      }
      const results = applicableResultsFor(target);
      if (results.length === 0) return;
      if (results.length === 1) {
        void applyMoveTo(target, results[0]);
        return;
      }
      setSelectedTarget(target);
    },
    [myTurn, selectedTarget, applicableResultsFor, applyMoveTo],
  );

  /** 선택된 말이 결과 r로 이동하면 도착할 노드 (완주는 참먹이 0번으로 표시) */
  const destNodeFor = useCallback(
    (target: number | "new", result: YutResult): number | null => {
      const piece: YutPiece | undefined =
        target === "new"
          ? { pos: "ready", trail: [] }
          : (state?.pieces[myId] ?? []).find(
              (p) => typeof p.pos === "number" && p.pos === target,
            );
      if (!piece) return null;
      const dest = computeDestination(piece, RESULT_STEPS[result]);
      if (!dest) return null;
      return dest.pos === "done" ? 0 : dest.pos;
    },
    [state, myId],
  );

  /** 현재 선택된 말이 이동 가능한 목적지 노드 → 결과 매핑 */
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
      void applyMoveTo(selectedTarget, r);
    },
    [selectedTarget, moveTargetResults, applyMoveTo],
  );

  // 종료 시 기록 저장
  useEffect(() => {
    if (!room || room.status !== "finished" || !me) return;
    if (savedRef.current === room.id) return;
    savedRef.current = room.id;

    const others = players.filter((p) => p.player_id !== myId).map((p) => p.nickname);
    const record = {
      roomId: room.id,
      gameType: "yut" as const,
      result: room.winner === myId ? ("win" as const) : ("lose" as const),
      opponentNickname: others.join(", ") || "?",
      moves: null,
    };
    (async () => {
      const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
      const session = data.session;
      if (session && supabase) {
        try {
          await saveServerRecord(supabase, session.user.id, record);
          return;
        } catch {
          // 서버 저장 실패 시 로컬로
        }
      }
      saveLocalRecord(record);
    })();
  }, [room, me, players, myId, supabase]);

  const copyLink = useCallback(() => {
    const url = window.location.href;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } finally {
      document.body.removeChild(ta);
    }
  }, []);

  // ---------- 렌더링 ----------

  if (!loaded || !room) {
    return (
      <Shell>
        <p className="mt-20 text-center font-plex text-sm text-mud">불러오는 중…</p>
      </Shell>
    );
  }

  const myPieces = state?.pieces[myId] ?? [];
  const selectableNodes = new Set<number>();
  if (myTurn && state && state.pending.length > 0) {
    for (const p of myPieces) {
      if (typeof p.pos !== "number") continue;
      if (applicableResultsFor(p.pos).length > 0) selectableNodes.add(p.pos);
    }
  }
  const newPieceResults = myTurn && state ? applicableResultsFor("new") : [];
  const winnerPlayer = players.find((p) => p.player_id === room.winner) ?? null;
  const turnPlayer = players.find((p) => p.player_id === room.current_turn) ?? null;

  return (
    <Shell>
      <header className="mb-4 flex w-full items-center justify-between">
        <Link
          href="/"
          className="font-plex text-xs text-mud underline-offset-4 transition hover:text-ink hover:underline"
        >
          ← 로비로
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-mud/40 px-2.5 py-1 font-plex text-[10px] text-ink-soft">
            말 {rules.pieceCount}개{rules.backdo ? " · 빽도" : ""}
          </span>
          <button
            onClick={rulesModal.reopen}
            className="rounded border border-mud/40 px-3 py-1.5 font-plex text-xs text-ink-soft transition hover:border-ink"
          >
            규칙 보기
          </button>
          <button
            onClick={copyLink}
            className="rounded border border-mud/40 px-3 py-1.5 font-plex text-xs text-ink-soft transition hover:border-ink"
          >
            {copied ? "복사됨 ✓" : "공유 링크 복사"}
          </button>
        </div>
      </header>

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-center">
        {/* 왼쪽: 윷 던지기 연출 */}
        <aside className="w-full lg:w-56 lg:shrink-0 lg:pt-8">
          {state?.lastThrow && room.status !== "waiting" ? (
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
                  {players.find((p) => p.player_id === state.lastThrow?.by)?.nickname}
                </p>
              </div>
            </div>
          ) : (
            room.status === "playing" && (
              <div className="hidden rounded-lg border border-dashed border-mud/30 px-4 py-10 text-center font-plex text-xs text-mud lg:block">
                윷을 던지면
                <br />
                여기에 결과가 나옵니다
              </div>
            )
          )}
        </aside>

        {/* 중앙: 보드 + 조작 */}
        <div className="flex w-full max-w-[558px] flex-col items-center lg:shrink-0">
          {room.status === "waiting" && (
            <div className="banner-in mb-4 w-full rounded-lg border border-mud/30 bg-paper-deep px-6 py-4 text-center">
              <p className="font-semibold">
                참가자 {players.length}/{MAX_PLAYERS}명 — 친구를 기다리는 중
              </p>
              <p className="mt-1 font-plex text-xs text-mud">
                링크를 보내면 바로 참가할 수 있습니다. 2명부터 시작 가능.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  onClick={copyLink}
                  className="rounded border border-mud/40 bg-paper px-5 py-2 text-sm text-ink-soft transition hover:border-ink"
                >
                  {copied ? "복사됨 ✓" : "공유 링크 복사"}
                </button>
                {isHost && (
                  <button
                    onClick={startGame}
                    disabled={players.length < 2}
                    className="rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft disabled:opacity-40"
                  >
                    게임 시작
                  </button>
                )}
              </div>
              {!isHost && me && (
                <p className="mt-2 font-plex text-[11px] text-mud">
                  방장({players[0]?.nickname})이 시작하길 기다리는 중…
                </p>
              )}
            </div>
          )}

          <YutBoard
            pieces={state?.pieces ?? {}}
            order={state?.order ?? []}
            selectableNodes={selectedTarget === null ? selectableNodes : new Set<number>()}
            selectedNode={typeof selectedTarget === "number" ? selectedTarget : null}
            moveTargets={moveTargetLabels}
            onNodeClick={(node) => selectTarget(node)}
            onMoveTargetClick={handleMoveTargetClick}
          />

          <div className="mt-4 w-full">
            {room.status === "playing" && state && (
              <div className="text-center">
                {!me && <p className="font-plex text-xs text-mud">관전 중입니다</p>}

                {me && !myTurn && (
                  <p className="font-plex text-xs text-mud">
                    {turnPlayer?.nickname ?? "상대"}의 차례입니다
                  </p>
                )}

                {me && twoPlayerOpponent && opponentOffline && (
                  <DisconnectBanner nickname={twoPlayerOpponent.nickname} onForfeit={forceForfeit} />
                )}

                {/* 무르기 — 신청자 본인 제외 전원의 동의가 필요 */}
                {me && canRequestUndo && (
                  <button
                    onClick={requestUndo}
                    className="mt-3 rounded border border-mud/40 px-4 py-1.5 font-plex text-xs text-ink-soft transition hover:border-ink"
                  >
                    무르기 신청 (1회)
                  </button>
                )}
                {me && undo?.by === myId && (
                  <p className="mt-3 font-plex text-xs text-mud">
                    무르기를 신청했습니다 — 동의 대기 중… ({undoApprovals.length}/{othersNeeded})
                  </p>
                )}
                {me && undo?.by && undo.by !== myId && !undoApprovals.includes(myId) && (
                  <div className="banner-in mt-3 rounded-lg border border-mud/30 bg-paper-deep px-4 py-3">
                    <p className="text-sm">
                      <span className="font-semibold">
                        {players.find((p) => p.player_id === undo.by)?.nickname ?? "상대"}
                      </span>
                      님이 무르기를 신청했습니다 — 허용하시겠습니까?
                    </p>
                    <div className="mt-2 flex justify-center gap-2">
                      <button
                        onClick={approveUndo}
                        className="rounded bg-vermil px-5 py-1.5 text-sm text-paper transition hover:opacity-85"
                      >
                        수락
                      </button>
                      <button
                        onClick={declineUndo}
                        className="rounded border border-mud/40 px-5 py-1.5 text-sm text-ink-soft transition hover:border-ink"
                      >
                        거절
                      </button>
                    </div>
                  </div>
                )}
                {me && undo?.by && undo.by !== myId && undoApprovals.includes(myId) && (
                  <p className="mt-3 font-plex text-xs text-mud">
                    동의했습니다 — 다른 참가자의 동의를 기다리는 중…
                  </p>
                )}
                {me && undo?.declined && !undo?.by && (
                  <p className="mt-3 font-plex text-xs text-mud">
                    {players.find((p) => p.player_id === undo.declined)?.nickname ?? "상대"}
                    님이 무르기를 거절했습니다.
                  </p>
                )}
                {me && myUndoUsed && !undo?.by && (
                  <p className="mt-1 font-plex text-[10px] text-mud/70">무르기를 이미 사용했습니다.</p>
                )}

                {myTurn && (
                  <div className="banner-in rounded-lg border border-vermil/40 bg-paper-deep px-4 py-3">
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
                            판 위의 점선 표시된 말을 클릭하거나, 오른쪽 내 대기 말을 눌러
                            새 말을 투입하세요
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
                )}
              </div>
            )}

            {room.status === "finished" && (
              <div className="banner-in rounded-lg border border-vermil/50 bg-paper-deep px-6 py-4 text-center shadow">
                <p className="text-xl font-semibold">
                  {room.winner === myId
                    ? "승리했습니다"
                    : `${winnerPlayer?.nickname ?? "상대"} 승리`}
                </p>
                <p className="mt-1 font-plex text-xs text-mud">
                  모든 말 완주{me ? " · 기록이 저장되었습니다" : ""}
                </p>
                <Link
                  href="/"
                  className="mt-3 inline-block rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft"
                >
                  로비로
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 플레이어별 말 현황 */}
        <aside className="w-full lg:w-56 lg:shrink-0 lg:pt-8">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {Array.from({ length: MAX_PLAYERS }, (_, i) => {
              const p = players[i] ?? null;
              const isTurn = p && room.status === "playing" && room.current_turn === p.player_id;
              const pcs = p && state ? state.pieces[p.player_id] ?? [] : [];
              const ready = pcs.filter((x) => x.pos === "ready").length;
              const done = pcs.filter((x) => x.pos === "done").length;
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-3 py-2.5 transition ${
                    isTurn ? "border-vermil bg-paper-deep shadow" : "border-mud/30"
                  } ${!p ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PLAYER_COLORS[i] }}
                    />
                    <p className="truncate text-sm font-semibold">
                      {p ? p.nickname : "빈 자리"}
                      {p && p.player_id === myId && (
                        <span className="ml-1 font-plex text-[10px] text-mud">(나)</span>
                      )}
                    </p>
                    {isTurn && (
                      <span className="ml-auto font-plex text-[10px] text-vermil">차례</span>
                    )}
                  </div>
                  {p && state && (
                    <>
                      <div className="mt-2 flex items-center gap-2">
                        {pcs.map((pc, pi) => {
                          const mine = p.player_id === myId;
                          const clickable =
                            mine && pc.pos === "ready" && newPieceResults.length > 0;
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
                                    (selectedTarget === "new"
                                      ? " ring-2 ring-vermil"
                                      : " ring-2 ring-vermil/40")
                                  : ""
                              }`}
                              style={{
                                borderColor: PLAYER_COLORS[i],
                                backgroundColor:
                                  pc.pos === "ready" ? "transparent" : PLAYER_COLORS[i],
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
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 hidden font-plex text-[10px] text-mud lg:block">
            ○ 대기 · ● 판 위 · 흐림 완주 — 내 차례엔 대기 말을 클릭해 새 말 투입
          </p>
        </aside>
      </div>

      <div className="mt-8 w-full">
        <KakaoAdFit adUnit="DAN-DXVo1uxzwvIXqjLT" width={320} height={100} />
      </div>

      <NicknameModal
        open={Boolean(needJoin)}
        defaultValue={typeof window !== "undefined" ? getStoredNickname() : ""}
        title={
          players.length === 0
            ? "윷놀이 방을 만들었습니다 — 닉네임 입력"
            : "윷놀이에 참가합니다 — 닉네임 입력"
        }
        onSubmit={join}
      />
      <RulesModal open={rulesModal.open} gameType="yut" onClose={rulesModal.close} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center px-4 py-6">
      {children}
    </main>
  );
}
