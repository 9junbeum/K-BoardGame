"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CatchmindCanvas, { type CatchmindCanvasHandle, type DrawOp } from "@/components/CatchmindCanvas";
import ChatWidget from "@/components/ChatWidget";
import KakaoAdFit from "@/components/KakaoAdFit";
import NicknameModal from "@/components/NicknameModal";
import RulesModal from "@/components/RulesModal";
import {
  applyCorrectGuess,
  applyTimeout,
  createCatchmindState,
  DEFAULT_CATCHMIND_RULES,
  isCorrectGuess,
  type CatchmindRules,
  type CatchmindState,
} from "@/games/catchmind/logic";
import { saveLocalRecord, saveServerRecord } from "@/lib/history";
import { getPlayerId, getStoredNickname, storeNickname } from "@/lib/player";
import { usePresence } from "@/lib/presence";
import { getSupabase, type PlayerRow } from "@/lib/supabase";
import { useRulesModal } from "@/lib/useRulesModal";
import { useTurnNotification } from "@/lib/useTurnNotification";

const MAX_PLAYERS = 4;
const PLAYER_COLORS = ["#8b2a1f", "#1a1614", "#2b4a6f", "#5a6f2b"];

interface CatchmindRoomRow {
  id: string;
  game_type: string;
  status: "waiting" | "playing" | "finished";
  state: CatchmindState | Record<string, never>;
  current_turn: string | null;
  winner: string | null;
  rules: Partial<CatchmindRules> | null;
  finished_at: string | null;
}

export default function CatchmindRoom({ roomId }: { roomId: string }) {
  const supabase = useMemo(() => getSupabase(), []);

  const [myId, setMyId] = useState("");
  const [room, setRoom] = useState<CatchmindRoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const savedRef = useRef<string | null>(null);
  const rulesModal = useRulesModal("catchmind");

  const canvasRef = useRef<CatchmindCanvasHandle>(null);
  // 이번 라운드의 전체 그리기 연산 — 늦게 들어온 사람에게 재생해 주기 위해 보관
  const opsLog = useRef<DrawOp[]>([]);

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
      if (!data) setNotFound(true);
      else {
        setRoom(data as CatchmindRoomRow);
        await fetchPlayers();
      }
      setLoaded(true);
    })();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as CatchmindRoomRow),
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

  const rules: CatchmindRules = useMemo(
    () => ({ ...DEFAULT_CATCHMIND_RULES, ...(room?.rules ?? {}) }),
    [room?.rules],
  );
  const state: CatchmindState | null =
    room && room.state && "order" in room.state ? (room.state as CatchmindState) : null;

  const me = players.find((p) => p.player_id === myId) ?? null;
  const isHost = players.length > 0 && players[0].player_id === myId;
  const isDrawer = Boolean(state && room?.status === "playing" && state.drawer === myId);
  const needJoin =
    loaded &&
    Boolean(room) &&
    myId !== "" &&
    !me &&
    room?.status === "waiting" &&
    players.length < MAX_PLAYERS;

  useTurnNotification(isDrawer);

  const online = usePresence(supabase, roomId, myId);

  // ---------- 최신 상태 ref (타이머/브로드캐스트 콜백의 stale closure 방지) ----------
  const roomRef = useRef(room);
  const stateRef = useRef(state);
  const rulesRef = useRef(rules);
  const isDrawerRef = useRef(isDrawer);
  useEffect(() => {
    roomRef.current = room;
    stateRef.current = state;
    rulesRef.current = rules;
    isDrawerRef.current = isDrawer;
  });

  // ---------- 그리기 실시간 동기화 (Supabase broadcast — DB를 거치지 않아 빠르다) ----------

  const drawChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  useEffect(() => {
    if (!supabase || !roomId || !myId) return;

    const channel = supabase
      .channel(`draw:${roomId}`)
      .on("broadcast", { event: "ops" }, ({ payload }) => {
        const ops = payload.ops as DrawOp[];
        opsLog.current.push(...ops);
        canvasRef.current?.apply(ops);
      })
      .on("broadcast", { event: "request_sync" }, ({ payload }) => {
        // 출제자만 응답해 중복 전송을 막는다
        if (!isDrawerRef.current || payload.from === myId) return;
        void channel.send({
          type: "broadcast",
          event: "sync",
          payload: { to: payload.from, ops: opsLog.current, roundNo: stateRef.current?.roundNo ?? 0 },
        });
      })
      .on("broadcast", { event: "sync" }, ({ payload }) => {
        if (payload.to !== myId) return;
        if (payload.roundNo !== stateRef.current?.roundNo) return;
        if (opsLog.current.length > 0) return; // 이미 그리는 중이면 무시
        opsLog.current = payload.ops as DrawOp[];
        canvasRef.current?.reset();
        canvasRef.current?.apply(opsLog.current);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // 진행 중인 그림 따라잡기
          void channel.send({ type: "broadcast", event: "request_sync", payload: { from: myId } });
        }
      });

    drawChannelRef.current = channel;
    return () => {
      drawChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, myId]);

  /** 내 캔버스에서 발생한 연산을 기록하고 브로드캐스트 */
  const emitOps = useCallback((ops: DrawOp[]) => {
    opsLog.current.push(...ops);
    void drawChannelRef.current?.send({ type: "broadcast", event: "ops", payload: { ops } });
  }, []);

  // 라운드가 바뀌면 캔버스를 백지로
  const roundNo = state?.roundNo ?? 0;
  useEffect(() => {
    opsLog.current = [];
    canvasRef.current?.reset();
  }, [roundNo]);

  // ---------- 참가 / 시작 ----------

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
      await fetchPlayers();
    },
    [supabase, room, players, roomId, myId, fetchPlayers],
  );

  const startGame = useCallback(async () => {
    if (!supabase || !room || !isHost || players.length < 2) return;
    const order = players.map((p) => p.player_id);
    const st = createCatchmindState(order, rules);
    setRoom((prev) =>
      prev ? { ...prev, status: "playing", current_turn: st.drawer, state: st } : prev,
    );
    await supabase
      .from("game_rooms")
      .update({ status: "playing", current_turn: st.drawer, state: st })
      .eq("id", roomId)
      .eq("status", "waiting");
  }, [supabase, room, isHost, players, rules, roomId]);

  // ---------- 정답 판정 (내가 보낸 채팅이 제시어와 일치하면) ----------

  const onChatSent = useCallback(
    async (text: string) => {
      const r = roomRef.current;
      const s = stateRef.current;
      if (!supabase || !r || !s || r.status !== "playing") return;
      if (s.drawer === myId) return; // 출제자는 정답 처리 불가
      if (!isCorrectGuess(s.word, text)) return;

      const result = applyCorrectGuess(s, myId, rulesRef.current);
      const update = result.won
        ? {
            state: result.state,
            status: "finished" as const,
            winner: myId,
            current_turn: null,
            finished_at: new Date().toISOString(),
          }
        : { state: result.state, current_turn: myId };

      setRoom((prev) => (prev ? ({ ...prev, ...update } as CatchmindRoomRow) : prev));
      // 이전 출제자 기준 가드 — 동시 정답 시 한 명만 인정된다
      await supabase
        .from("game_rooms")
        .update(update)
        .eq("id", roomId)
        .eq("status", "playing")
        .eq("current_turn", s.drawer);
    },
    [supabase, myId, roomId],
  );

  // ---------- 제한시간 ----------

  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const r = roomRef.current;
      const s = stateRef.current;
      if (!r || r.status !== "playing" || !s) return;
      const t = Date.now();
      setNow(t);
      // 마감 + 2초 유예 후 아무 클라이언트나 다음 라운드로 넘긴다 (가드로 중복 방지)
      if (t >= new Date(s.deadline).getTime() + 2000) {
        const next = applyTimeout(s, rulesRef.current);
        setRoom((prev) => (prev ? { ...prev, state: next, current_turn: next.drawer } : prev));
        void supabase
          ?.from("game_rooms")
          .update({ state: next, current_turn: next.drawer })
          .eq("id", roomId)
          .eq("status", "playing")
          .eq("current_turn", s.drawer);
      }
    }, 300);
    return () => clearInterval(id);
  }, [supabase, roomId]);

  const secondsLeft =
    state && now
      ? Math.max(0, Math.ceil((new Date(state.deadline).getTime() - now) / 1000))
      : rules.drawSeconds;

  // ---------- 종료 시 기록 저장 ----------

  useEffect(() => {
    if (!room || room.status !== "finished" || !me) return;
    if (savedRef.current === room.id) return;
    savedRef.current = room.id;

    const others = players.filter((p) => p.player_id !== myId).map((p) => p.nickname);
    const record = {
      roomId: room.id,
      gameType: "catchmind" as const,
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

  if (!supabase) {
    return (
      <Shell>
        <p className="mt-20 text-center text-ink-soft">
          실시간 대전을 하려면 Supabase 설정이 필요합니다.
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

  const drawerPlayer = state ? players.find((p) => p.player_id === state.drawer) ?? null : null;
  const winnerPlayer = players.find((p) => p.player_id === room.winner) ?? null;

  return (
    <Shell>
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
          <span className="rounded-full border border-mud/40 px-2.5 py-1 font-plex text-[10px] text-ink-soft">
            {rules.targetScore}점 · {rules.drawSeconds}초
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

      {/* 점수판 */}
      <div className="mb-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: MAX_PLAYERS }, (_, i) => {
          const p = players[i] ?? null;
          const isTurn = p && state && room.status === "playing" && state.drawer === p.player_id;
          const offline = p && me && online.has(myId) && !online.has(p.player_id);
          return (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 transition ${
                isTurn ? "border-vermil bg-paper-deep shadow" : "border-mud/30"
              } ${!p ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: PLAYER_COLORS[i] }}
                />
                <p className="truncate text-sm font-semibold">
                  {p ? p.nickname : "빈 자리"}
                  {p && p.player_id === myId && (
                    <span className="ml-1 font-plex text-[10px] text-mud">(나)</span>
                  )}
                </p>
              </div>
              <p className="mt-0.5 font-plex text-[10px] text-mud">
                {p && state ? `${state.scores[p.player_id] ?? 0}점` : "—"}
                {isTurn ? " · 그리는 중 🖌" : ""}
                {offline && room.status === "playing" ? " · 오프라인" : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* 제시어 / 타이머 */}
      {room.status === "playing" && state && (
        <div className="banner-in mb-3 w-full rounded-lg border border-mud/30 bg-paper-deep px-4 py-2.5 text-center">
          {isDrawer ? (
            <p className="text-sm">
              제시어: <span className="text-lg font-bold text-vermil">{state.word}</span>
              <span className="ml-2 font-plex text-xs text-mud">
                — 그림으로만 설명하세요! (남은 시간 {secondsLeft}초)
              </span>
            </p>
          ) : (
            <p className="text-sm">
              <span className="font-semibold">{drawerPlayer?.nickname ?? "?"}</span>님이 그리는 중 —{" "}
              <span className="font-plex tracking-[0.3em]">{"◯".repeat(state.word.replace(/\s/g, "").length)}</span>
              <span className="ml-2 font-plex text-xs text-mud">
                ({state.word.replace(/\s/g, "").length}글자 · {secondsLeft}초) 채팅으로 정답을 입력하세요!
              </span>
            </p>
          )}
        </div>
      )}

      <CatchmindCanvas ref={canvasRef} canDraw={isDrawer} onOps={emitOps} />

      {/* 상태 배너 */}
      <div className="mt-5 w-full">
        {room.status === "waiting" && (
          <div className="banner-in rounded-lg border border-mud/30 bg-paper-deep px-6 py-4 text-center">
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

        {room.status === "finished" && (
          <div className="banner-in rounded-lg border border-vermil/50 bg-paper-deep px-6 py-4 text-center shadow">
            <p className="text-xl font-semibold">
              {room.winner === myId ? "승리했습니다 🎉" : `${winnerPlayer?.nickname ?? "?"} 승리`}
            </p>
            <p className="mt-1 font-plex text-xs text-mud">
              {rules.targetScore}점 달성{me ? " · 기록이 저장되었습니다" : ""}
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

      <ChatWidget roomId={roomId} myId={myId} nickname={me?.nickname ?? null} onSent={onChatSent} />

      <NicknameModal
        open={Boolean(needJoin)}
        defaultValue={typeof window !== "undefined" ? getStoredNickname() : ""}
        title={
          players.length === 0
            ? "캐치마인드 방을 만들었습니다 — 닉네임 입력"
            : "캐치마인드에 참가합니다 — 닉네임 입력"
        }
        onSubmit={join}
      />
      <RulesModal open={rulesModal.open} gameType="catchmind" onClose={rulesModal.close} />
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
