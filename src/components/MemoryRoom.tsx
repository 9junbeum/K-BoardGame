"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DisconnectBanner from "@/components/DisconnectBanner";
import KakaoAdFit from "@/components/KakaoAdFit";
import MemoryBoard from "@/components/MemoryBoard";
import NicknameModal from "@/components/NicknameModal";
import RulesModal from "@/components/RulesModal";
import {
  createMemoryState,
  DEFAULT_MEMORY_RULES,
  GRID_DIMS,
  pickCard,
  timeoutTurn,
  type MemoryRules,
  type MemoryState,
} from "@/games/memory/logic";
import { saveLocalRecord, saveServerRecord } from "@/lib/history";
import { getPlayerId, getStoredNickname, storeNickname } from "@/lib/player";
import { usePresence } from "@/lib/presence";
import { getSupabase, type PlayerRow } from "@/lib/supabase";
import { useRulesModal } from "@/lib/useRulesModal";
import { useTurnNotification } from "@/lib/useTurnNotification";

interface MemoryRematchState {
  by?: string;
  declined?: boolean;
  next_room_id?: string;
}

interface MemoryRoomRow {
  id: string;
  game_type: string;
  status: "waiting" | "playing" | "finished";
  state: MemoryState;
  current_turn: string | null;
  winner: string | null; // player_id 또는 'draw'
  rules: Partial<MemoryRules> | null;
  rematch: MemoryRematchState | null;
  finished_at: string | null;
}

export default function MemoryRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [myId, setMyId] = useState("");
  const [room, setRoom] = useState<MemoryRoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const savedRef = useRef<string | null>(null);
  const rulesModal = useRulesModal("memory");

  const [prevRoomId, setPrevRoomId] = useState(roomId);
  if (prevRoomId !== roomId) {
    setPrevRoomId(roomId);
    setRoom(null);
    setPlayers([]);
    setLoaded(false);
    setNotFound(false);
  }

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
      if (!data) {
        setNotFound(true);
      } else {
        setRoom(data as MemoryRoomRow);
        await fetchPlayers();
      }
      setLoaded(true);
    })();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as MemoryRoomRow),
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

  const me = players.find((p) => p.player_id === myId) ?? null;
  const opponent = players.find((p) => p.player_id !== myId) ?? null;
  const isSpectator = loaded && !me && players.length >= 2;
  const needJoin = loaded && Boolean(room) && myId !== "" && !me && players.length < 2;
  const rematch = room?.rematch ?? null;
  const rules: MemoryRules = useMemo(
    () => ({ ...DEFAULT_MEMORY_RULES, ...(room?.rules ?? {}) }),
    [room?.rules],
  );
  const { rows, cols } = GRID_DIMS[rules.grid];
  const state: MemoryState = room?.state ?? createMemoryState(rules.grid, rules.turnSeconds);

  // 상대 접속 끊김 감지
  const online = usePresence(supabase, roomId, myId);
  const opponentOffline =
    room?.status === "playing" &&
    Boolean(me) &&
    online.has(myId) &&
    Boolean(opponent && !online.has(opponent.player_id));

  useTurnNotification(Boolean(room && room.status === "playing" && room.current_turn === myId));

  const forceForfeit = useCallback(async () => {
    if (!supabase || !room || !me) return;
    const update = {
      status: "finished" as const,
      winner: myId,
      finished_at: new Date().toISOString(),
    };
    setRoom((prev) => (prev ? { ...prev, ...update } : prev));
    await supabase.from("game_rooms").update(update).eq("id", roomId).eq("status", "playing");
  }, [supabase, room, me, myId, roomId]);

  // 재대결 성사 → 새 방으로 이동
  useEffect(() => {
    const nextId = rematch?.next_room_id;
    if (nextId && me) {
      router.push(`/room/${nextId}`);
    }
  }, [rematch?.next_room_id, me, router]);

  // 방 참가 — 2번째 참가자가 들어오면 카드를 섞어 바로 시작한다
  const join = useCallback(
    async (nickname: string) => {
      if (!supabase || !room) return;
      storeNickname(nickname);
      const { error } = await supabase.from("game_players").insert({
        room_id: roomId,
        player_id: myId,
        nickname,
        color: String(players.length),
      });
      if (error) {
        await fetchPlayers();
        return;
      }
      if (players.length === 1) {
        const firstId = Math.random() < 0.5 ? players[0].player_id : myId;
        await supabase
          .from("game_rooms")
          .update({
            status: "playing",
            current_turn: firstId,
            state: createMemoryState(rules.grid, rules.turnSeconds),
          })
          .eq("id", roomId)
          .eq("status", "waiting");
      }
      await fetchPlayers();
    },
    [supabase, room, players, roomId, myId, fetchPlayers, rules],
  );

  // ---------- 카드 뒤집기 ----------

  const pick = useCallback(
    async (i: number) => {
      if (!supabase || !room || !me || room.status !== "playing") return;
      if (room.current_turn !== myId) return;
      const r = pickCard(state, i, myId, rules.turnSeconds);
      if (!r) return;

      let update: Partial<MemoryRoomRow>;
      if (r.gameOver) {
        const mine = r.state.scores[myId] ?? 0;
        const theirs = opponent ? (r.state.scores[opponent.player_id] ?? 0) : 0;
        const winner = mine === theirs ? "draw" : mine > theirs ? myId : (opponent?.player_id ?? "draw");
        update = {
          state: r.state,
          status: "finished",
          winner,
          finished_at: new Date().toISOString(),
        };
      } else {
        update = {
          state: r.state,
          current_turn: r.turnEnded ? (opponent?.player_id ?? null) : myId,
        };
      }

      setRoom((prev) => (prev ? ({ ...prev, ...update } as MemoryRoomRow) : prev));
      const { data, error } = await supabase
        .from("game_rooms")
        .update(update)
        .eq("id", roomId)
        .eq("current_turn", myId)
        .select("id");
      if (error || !data || data.length === 0) {
        const { data: fresh } = await supabase.from("game_rooms").select("*").eq("id", roomId).maybeSingle();
        if (fresh) setRoom(fresh as MemoryRoomRow);
      }
    },
    [supabase, room, me, opponent, myId, roomId, rules, state],
  );

  // ---------- 턴 제한 시간 ----------
  //
  // 이 타이머는 useEffect의 의존성 배열 타이밍에 기대면 안 된다 — room/state가 바뀔 때마다
  // effect가 다시 만들어지는 타이밍과, setInterval이 이미 예약해 둔 다음 tick이 겹치면
  // "방금 막 새로 시작된 상대 턴"을 "직전(내) 턴의 낡은 마감시각"으로 잘못 검사해
  // 거의 곧바로 타임아웃 처리해버리는 경합이 생긴다(그래서 상대 턴이 되자마자 다시 내 턴으로
  // 돌아오는 버그가 났다). ref에 항상 최신 값을 담아두고, 인터벌은 컴포넌트 생애 동안
  // 단 하나만 유지하면서 매번 ref에서 최신 값을 읽어 검사한다.

  const roomRef = useRef(room);
  const stateRef = useRef(state);
  const playersRef = useRef(players);
  const rulesRef = useRef(rules);
  // 렌더 중에는 ref를 쓸 수 없으므로(react-hooks/refs), 매 렌더 뒤 effect에서 최신값으로 갱신한다
  useEffect(() => {
    roomRef.current = room;
    stateRef.current = state;
    playersRef.current = players;
    rulesRef.current = rules;
  });

  const timeoutAction = useCallback(async () => {
    const r = roomRef.current;
    if (!supabase || !r || r.status !== "playing" || !r.current_turn) return;
    const timedOut = r.current_turn;
    const nextTurn = playersRef.current.find((p) => p.player_id !== timedOut)?.player_id ?? null;
    const update = {
      state: timeoutTurn(stateRef.current, rulesRef.current.turnSeconds),
      current_turn: nextTurn,
    };
    setRoom((prev) => (prev ? ({ ...prev, ...update } as MemoryRoomRow) : prev));
    await supabase.from("game_rooms").update(update).eq("id", roomId).eq("current_turn", timedOut);
  }, [supabase, roomId]);

  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const r = roomRef.current;
      if (!r || r.status !== "playing" || !r.current_turn) return;
      const t = Date.now();
      setNow(t);
      if (t >= new Date(stateRef.current.deadline).getTime()) {
        void timeoutAction();
      }
    }, 300);
    return () => clearInterval(id);
  }, [timeoutAction]);

  const secondsLeft = now
    ? Math.max(0, Math.ceil((new Date(state.deadline).getTime() - now) / 1000))
    : rules.turnSeconds;

  // ---------- 재대결 ----------

  const requestRematch = useCallback(async () => {
    if (!supabase || !room || !me) return;
    const value = { by: myId };
    setRoom((prev) => (prev ? { ...prev, rematch: value } : prev));
    await supabase
      .from("game_rooms")
      .update({ rematch: value })
      .eq("id", roomId)
      .eq("status", "finished");
  }, [supabase, room, me, myId, roomId]);

  const declineRematch = useCallback(async () => {
    if (!supabase || !room || !rematch) return;
    const value = { ...rematch, declined: true };
    setRoom((prev) => (prev ? { ...prev, rematch: value } : prev));
    await supabase.from("game_rooms").update({ rematch: value }).eq("id", roomId);
  }, [supabase, room, rematch, roomId]);

  const acceptRematch = useCallback(async () => {
    if (!supabase || !room || !me || !opponent || !rematch) return;
    const { data: newRoom, error } = await supabase
      .from("game_rooms")
      .insert({
        game_type: "memory",
        status: "playing",
        state: createMemoryState(rules.grid, rules.turnSeconds),
        current_turn: Math.random() < 0.5 ? me.player_id : opponent.player_id,
        rules: room.rules ?? DEFAULT_MEMORY_RULES,
      })
      .select("id")
      .single();
    if (error || !newRoom) return;

    await supabase.from("game_players").insert([
      {
        room_id: newRoom.id,
        player_id: me.player_id,
        user_id: me.user_id,
        nickname: me.nickname,
        color: "0",
      },
      {
        room_id: newRoom.id,
        player_id: opponent.player_id,
        user_id: opponent.user_id,
        nickname: opponent.nickname,
        color: "1",
      },
    ]);

    await supabase
      .from("game_rooms")
      .update({ rematch: { ...rematch, next_room_id: newRoom.id } })
      .eq("id", roomId);

    router.push(`/room/${newRoom.id}`);
  }, [supabase, room, me, opponent, rematch, roomId, router, rules]);

  // 종료 시 기록 저장
  useEffect(() => {
    if (!room || room.status !== "finished" || !me) return;
    if (savedRef.current === room.id) return;
    savedRef.current = room.id;

    const record = {
      roomId: room.id,
      gameType: "memory" as const,
      result:
        room.winner === "draw" ? ("draw" as const)
        : room.winner === myId ? ("win" as const)
        : ("lose" as const),
      opponentNickname: opponent?.nickname ?? "?",
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
  }, [room, me, opponent, myId, supabase]);

  const copyLink = useCallback(() => {
    const url = window.location.href;
    const markCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(markCopied);
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
      markCopied();
    } finally {
      document.body.removeChild(ta);
    }
  }, []);

  // ---------- 렌더링 ----------

  if (!supabase) {
    return (
      <Shell>
        <p className="mt-20 text-center text-ink-soft">
          실시간 대전을 하려면 Supabase 설정이 필요합니다.
        </p>
        <p className="mt-2 text-center font-plex text-xs text-mud">
          .env.local 에 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY를 넣고 재시작하세요.
        </p>
      </Shell>
    );
  }

  if (loaded && notFound) {
    return (
      <Shell>
        <p className="mt-20 text-center text-ink-soft">방을 찾을 수 없습니다.</p>
        <div className="mt-4 text-center">
          <Link href="/" className="text-vermil underline underline-offset-4">
            로비로 돌아가기
          </Link>
        </div>
      </Shell>
    );
  }

  if (!loaded || !room) {
    return (
      <Shell>
        <p className="mt-20 text-center font-plex text-sm text-mud">불러오는 중…</p>
      </Shell>
    );
  }

  const finished = room.status === "finished";
  const myTurn = room.status === "playing" && room.current_turn === myId;
  const turnPlayer = players.find((p) => p.player_id === room.current_turn) ?? null;
  const winnerPlayer = players.find((p) => p.player_id === room.winner) ?? null;
  const rematchPending = rematch && !rematch.declined && !rematch.next_room_id;

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
            {rules.grid} · 턴 {rules.turnSeconds}초
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

      {/* 플레이어 패널 */}
      <div className="mb-4 flex w-full max-w-[560px] items-center justify-between gap-2">
        {[me, opponent].map((p, i) => {
          const isTurn = room.status === "playing" && p && room.current_turn === p.player_id;
          const score = p ? (state.scores[p.player_id] ?? 0) : 0;
          return (
            <div
              key={p?.player_id ?? i}
              className={`flex flex-1 items-center gap-2 rounded-lg border px-4 py-2.5 transition ${
                isTurn ? "border-vermil bg-paper-deep shadow" : "border-mud/30"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {p ? p.nickname : "대기 중…"}
                  {p && p.player_id === myId && (
                    <span className="ml-1 font-plex text-[10px] text-mud">(나)</span>
                  )}
                </p>
                <p className="font-plex text-[10px] text-mud">
                  맞춘 짝 {score}
                  {isTurn ? " · 차례" : ""}
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
        interactive={myTurn}
        onPick={pick}
      />
      <p className="mt-1 font-plex text-[10px] text-mud">
        {rows}×{cols} 배열 · 총 {(rows * cols) / 2}쌍
      </p>

      {/* 상태 배너 */}
      <div className="mt-5 w-full max-w-[560px]">
        {room.status === "waiting" && (
          <div className="banner-in rounded-lg border border-mud/30 bg-paper-deep px-6 py-4 text-center">
            <p className="font-semibold">친구를 기다리는 중입니다</p>
            <p className="mt-1 font-plex text-xs text-mud">
              아래 링크를 보내면 바로 대국이 시작됩니다.
            </p>
            <button
              onClick={copyLink}
              className="mt-3 rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft"
            >
              {copied ? "복사됨 ✓" : "공유 링크 복사"}
            </button>
          </div>
        )}

        {room.status === "playing" && (
          <div className="text-center">
            <p className="font-plex text-xs text-mud">
              {isSpectator
                ? "관전 중입니다"
                : myTurn
                  ? "당신 차례입니다 — 카드를 클릭하세요"
                  : `${turnPlayer?.nickname ?? "상대"}의 차례입니다`}
            </p>
            {me && (
              <p
                className={`mt-1 font-plex text-lg font-bold ${
                  secondsLeft <= 5 ? "text-vermil" : "text-ink-soft"
                }`}
              >
                {secondsLeft}초
              </p>
            )}

            {me && opponent && opponentOffline && (
              <DisconnectBanner nickname={opponent.nickname} onForfeit={forceForfeit} />
            )}
          </div>
        )}

        {finished && (
          <div className="banner-in rounded-lg border border-vermil/50 bg-paper-deep px-6 py-4 text-center shadow">
            <p className="text-xl font-semibold">
              {room.winner === "draw"
                ? "무승부"
                : room.winner === myId
                  ? "승리했습니다"
                  : `${winnerPlayer?.nickname ?? "상대"} 승리`}
            </p>
            <p className="mt-1 font-plex text-xs text-mud">
              {me ? (state.scores[myId] ?? 0) : 0} : {opponent ? (state.scores[opponent.player_id] ?? 0) : 0}
              {" · 기록이 저장되었습니다"}
            </p>

            {/* 재대결 */}
            {me && !rematch && (
              <div className="mt-3 flex justify-center gap-2">
                <button
                  onClick={requestRematch}
                  className="rounded bg-vermil px-6 py-2 text-sm text-paper transition hover:opacity-85"
                >
                  재대결 신청
                </button>
                <Link
                  href="/"
                  className="rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft"
                >
                  로비로
                </Link>
              </div>
            )}

            {me && rematchPending && rematch.by === myId && (
              <p className="mt-3 font-plex text-xs text-mud">
                재대결을 신청했습니다 — {opponent?.nickname ?? "상대"}의 수락을 기다리는 중…
              </p>
            )}

            {me && rematchPending && rematch.by !== myId && (
              <div className="mt-3">
                <p className="text-sm">
                  <span className="font-semibold">{opponent?.nickname ?? "상대"}</span>
                  님이 재대결을 신청했습니다.
                </p>
                <div className="mt-2 flex justify-center gap-2">
                  <button
                    onClick={acceptRematch}
                    className="rounded bg-vermil px-6 py-2 text-sm text-paper transition hover:opacity-85"
                  >
                    수락
                  </button>
                  <button
                    onClick={declineRematch}
                    className="rounded border border-mud/40 px-6 py-2 text-sm text-ink-soft transition hover:border-ink"
                  >
                    거절
                  </button>
                </div>
              </div>
            )}

            {me && rematch?.declined && (
              <div className="mt-3">
                <p className="font-plex text-xs text-mud">
                  {rematch.by === myId
                    ? "상대가 재대결을 거절했습니다."
                    : "재대결을 거절했습니다."}
                </p>
                <Link
                  href="/"
                  className="mt-2 inline-block rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft"
                >
                  로비로
                </Link>
              </div>
            )}

            {me && rematch?.next_room_id && !rematch.declined && (
              <p className="mt-3 font-plex text-xs text-vermil">새 대국으로 이동 중…</p>
            )}

            {!me && (
              <Link
                href="/"
                className="mt-3 inline-block rounded bg-ink px-6 py-2 text-sm text-paper transition hover:bg-ink-soft"
              >
                로비로
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 w-full">
        <KakaoAdFit adUnit="DAN-DXVo1uxzwvIXqjLT" width={320} height={100} />
      </div>

      <NicknameModal
        open={needJoin}
        defaultValue={typeof window !== "undefined" ? getStoredNickname() : ""}
        title={players.length === 0 ? "카드 뒤집기 방을 만들었습니다 — 닉네임 입력" : "대국에 참가합니다 — 닉네임 입력"}
        onSubmit={join}
      />
      <RulesModal open={rulesModal.open} gameType="memory" onClose={rulesModal.close} />
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
