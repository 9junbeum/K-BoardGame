"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import NicknameModal from "@/components/NicknameModal";
import YutBoard, { PLAYER_COLORS } from "@/components/YutBoard";
import {
  applyThrow,
  applyYutMove,
  canApplyResult,
  createYutState,
  DEFAULT_YUT_RULES,
  isTurnOver,
  nextPlayer,
  RESULT_STEPS,
  throwSticks,
  YUT_RESULT_LABEL,
  type YutResult,
  type YutRules,
  type YutState,
} from "@/games/yut/logic";
import { saveLocalRecord, saveServerRecord } from "@/lib/history";
import { getPlayerId, getStoredNickname, storeNickname } from "@/lib/player";
import { getSupabase, type PlayerRow } from "@/lib/supabase";

const MAX_PLAYERS = 4;

interface YutRoomRow {
  id: string;
  game_type: string;
  status: "waiting" | "playing" | "finished";
  state: YutState | Record<string, never>;
  current_turn: string | null;
  winner: string | null;
  rules: Partial<YutRules> | null;
  finished_at: string | null;
}

export default function YutRoom({ roomId }: { roomId: string }) {
  const supabase = useMemo(() => getSupabase(), []);

  const [myId, setMyId] = useState("");
  const [room, setRoom] = useState<YutRoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<YutResult | null>(null);
  const savedRef = useRef<string | null>(null);

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

  const me = players.find((p) => p.player_id === myId) ?? null;
  const isHost = players.length > 0 && players[0].player_id === myId;
  const myTurn = room?.status === "playing" && room.current_turn === myId && Boolean(state);
  const needJoin =
    loaded &&
    Boolean(room) &&
    myId !== "" &&
    !me &&
    room?.status === "waiting" &&
    players.length < MAX_PLAYERS;

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
    await commit(resolveTurn(st));
  }, [myTurn, state, rules, myId, commit, resolveTurn]);

  const applyTo = useCallback(
    async (target: number | "new") => {
      if (!myTurn || !state || !selected) return;
      let t: number | "new" = target;
      if (typeof target === "number") {
        const idx = (state.pieces[myId] ?? []).findIndex(
          (p) => typeof p.pos === "number" && p.pos === target,
        );
        if (idx === -1) return;
        t = idx;
      }
      const r = applyYutMove(state, myId, t, selected);
      if (!r) return;
      setSelected(null);
      if (r.won) {
        await commit({
          state: r.state,
          status: "finished",
          winner: myId,
          current_turn: null as unknown as string,
          finished_at: new Date().toISOString(),
        });
        return;
      }
      await commit(resolveTurn(r.state));
    },
    [myTurn, state, selected, myId, commit, resolveTurn],
  );

  // 자동 선택/해제는 마이크로태스크로 (effect 내 동기 setState 회피)
  useEffect(() => {
    if (!myTurn || !state) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (selected && !state.pending.includes(selected)) {
        setSelected(null);
        return;
      }
      if (selected === null && state.throwsLeft <= 0) {
        const usable = state.pending.find((r) => canApplyResult(state, myId, r));
        if (usable) setSelected(usable);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [myTurn, state, selected, myId]);

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
  const steps = selected ? RESULT_STEPS[selected] : 0;
  const canEnterNew =
    myTurn && selected !== null && steps > 0 && myPieces.some((p) => p.pos === "ready");
  const selectableNodes = new Set<number>();
  if (myTurn && state && selected) {
    for (const p of myPieces) {
      if (typeof p.pos !== "number") continue;
      const d = RESULT_STEPS[selected] === -1 ? p.trail.length > 1 : true;
      if (d) selectableNodes.add(p.pos);
    }
  }
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
            onClick={copyLink}
            className="rounded border border-mud/40 px-3 py-1.5 font-plex text-xs text-ink-soft transition hover:border-ink"
          >
            {copied ? "복사됨 ✓" : "공유 링크 복사"}
          </button>
        </div>
      </header>

      {/* 플레이어 패널 */}
      <div className="mb-4 grid w-full max-w-[558px] grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: MAX_PLAYERS }, (_, i) => {
          const p = players[i] ?? null;
          const isTurn = p && room.status === "playing" && room.current_turn === p.player_id;
          const pcs = p && state ? state.pieces[p.player_id] ?? [] : [];
          const ready = pcs.filter((x) => x.pos === "ready").length;
          const done = pcs.filter((x) => x.pos === "done").length;
          return (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 transition ${
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
              </div>
              {p && state && (
                <p className="mt-0.5 font-plex text-[10px] text-mud">
                  대기 {ready} · 완주 {done}/{rules.pieceCount}
                  {isTurn ? " · 차례" : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* 대기 중 */}
      {room.status === "waiting" && (
        <div className="banner-in mb-4 w-full max-w-[558px] rounded-lg border border-mud/30 bg-paper-deep px-6 py-4 text-center">
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

      {/* 마지막 던지기 */}
      {state?.lastThrow && room.status !== "waiting" && (
        <div className="mb-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            {state.lastThrow.sticks.map((flat, i) => (
              <span
                key={i}
                className={`inline-block h-8 w-3 rounded-full border ${
                  flat ? "border-mud/50 bg-paper" : "border-ink bg-ink-soft"
                }`}
                title={flat ? "배" : "등"}
              />
            ))}
          </div>
          <p className="text-lg font-bold text-vermil">
            {YUT_RESULT_LABEL[state.lastThrow.result]}
            <span className="ml-2 font-plex text-[10px] font-normal text-mud">
              {players.find((p) => p.player_id === state.lastThrow?.by)?.nickname}
            </span>
          </p>
        </div>
      )}

      <YutBoard
        pieces={state?.pieces ?? {}}
        order={state?.order ?? []}
        selectableNodes={selectableNodes}
        onNodeClick={(node) => applyTo(node)}
      />

      {/* 조작 영역 */}
      <div className="mt-4 w-full max-w-[558px]">
        {room.status === "playing" && state && (
          <div className="text-center">
            {!me && <p className="font-plex text-xs text-mud">관전 중입니다</p>}

            {me && !myTurn && (
              <p className="font-plex text-xs text-mud">
                {turnPlayer?.nickname ?? "상대"}의 차례입니다
              </p>
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
                    <p className="font-plex text-[11px] text-mud">
                      적용할 결과를 고른 뒤, 움직일 말(또는 새 말)을 선택하세요
                    </p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {state.pending.map((r, i) => (
                        <button
                          key={`${r}-${i}`}
                          onClick={() => setSelected(r)}
                          disabled={!canApplyResult(state, myId, r)}
                          className={`rounded-full border px-4 py-1.5 text-sm transition ${
                            selected === r
                              ? "border-vermil bg-vermil text-paper"
                              : "border-mud/40 text-ink-soft hover:border-ink disabled:opacity-40"
                          }`}
                        >
                          {YUT_RESULT_LABEL[r]}
                          <span className="ml-1 font-plex text-[10px] opacity-70">
                            {RESULT_STEPS[r] > 0 ? `+${RESULT_STEPS[r]}` : "-1"}
                          </span>
                        </button>
                      ))}
                    </div>
                    {selected && (
                      <div className="mt-2 flex justify-center gap-2">
                        {canEnterNew && (
                          <button
                            onClick={() => applyTo("new")}
                            className="rounded border border-vermil/60 px-4 py-1.5 font-plex text-xs text-vermil transition hover:bg-vermil hover:text-paper"
                          >
                            새 말 투입
                          </button>
                        )}
                        {selectableNodes.size > 0 && (
                          <span className="self-center font-plex text-[10px] text-mud">
                            판 위의 점선 표시된 말을 클릭
                          </span>
                        )}
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
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center px-4 py-6">
      {children}
    </main>
  );
}
