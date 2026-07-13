"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChatWidget from "@/components/ChatWidget";
import DisconnectBanner from "@/components/DisconnectBanner";
import KakaoAdFit from "@/components/KakaoAdFit";
import NicknameModal from "@/components/NicknameModal";
import RulesModal from "@/components/RulesModal";
import SagmokBoard from "@/components/SagmokBoard";
import {
  applyDrop,
  boardFromMoves,
  checkWin,
  COLS,
  DEFAULT_SAGMOK_RULES,
  nextColor,
  ROWS,
  type GameState,
  type SagmokRules,
  type StoneColor,
} from "@/games/sagmok/logic";
import { saveLocalRecord, saveServerRecord } from "@/lib/history";
import { getPlayerId, getStoredNickname, storeNickname } from "@/lib/player";
import { usePresence } from "@/lib/presence";
import { getSupabase, type PlayerRow } from "@/lib/supabase";
import { useRulesModal } from "@/lib/useRulesModal";
import { useTurnNotification } from "@/lib/useTurnNotification";

const COLOR_LABEL = { b: "흑", w: "백" } as const;

interface SagmokUndoState {
  by?: string; // 무르기를 신청한 player_id
  declined?: string; // 거절당한 신청자 player_id
  used?: string[]; // 무르기를 이미 사용한 player_id 목록
}

interface SagmokRematchState {
  by?: string;
  declined?: boolean;
  next_room_id?: string;
}

interface SagmokRoomRow {
  id: string;
  game_type: string;
  status: "waiting" | "playing" | "finished";
  state: GameState;
  current_turn: string | null;
  winner: string | null; // player_id 또는 'draw'
  rules: Partial<SagmokRules> | null;
  undo: SagmokUndoState | null;
  rematch: SagmokRematchState | null;
  finished_at: string | null;
}

export default function SagmokRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [myId, setMyId] = useState("");
  const [room, setRoom] = useState<SagmokRoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const savedRef = useRef<string | null>(null);
  const rulesModal = useRulesModal("sagmok");

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
        setRoom(data as SagmokRoomRow);
        await fetchPlayers();
      }
      setLoaded(true);
    })();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new as SagmokRoomRow),
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
  const rules: SagmokRules = useMemo(
    () => ({ ...DEFAULT_SAGMOK_RULES, ...(room?.rules ?? {}) }),
    [room?.rules],
  );
  const undo = room?.undo ?? null;
  const state: GameState = useMemo(() => room?.state ?? { moves: [] }, [room?.state]);

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

  // 방 참가
  const join = useCallback(
    async (nickname: string) => {
      if (!supabase || !room) return;
      storeNickname(nickname);
      let color: StoneColor;
      if (players.length === 0) {
        color =
          rules.firstMove === "host" ? "b"
          : rules.firstMove === "guest" ? "w"
          : Math.random() < 0.5 ? "b" : "w";
      } else {
        color = players[0].color === "b" ? "w" : "b";
      }
      const { error } = await supabase.from("game_players").insert({
        room_id: roomId,
        player_id: myId,
        nickname,
        color,
      });
      if (error) {
        await fetchPlayers();
        return;
      }
      if (players.length === 1) {
        const black = players[0].color === "b" ? players[0].player_id : myId;
        await supabase
          .from("game_rooms")
          .update({ status: "playing", current_turn: black })
          .eq("id", roomId)
          .eq("status", "waiting");
      }
      await fetchPlayers();
    },
    [supabase, room, players, roomId, myId, fetchPlayers, rules],
  );

  // ---------- 착수 (열에 떨어뜨리기) ----------

  const drop = useCallback(
    async (x: number) => {
      if (!supabase || !room || !me || room.status !== "playing") return;
      if (room.current_turn !== myId) return;
      if (me.color !== nextColor(state.moves)) return;

      const r = applyDrop(state, x);
      if (!r) return; // 가득 찬 열만 클릭되므로 정상 진행 시 발생하지 않음

      const finished = Boolean(r.win) || r.draw;
      const update = {
        state: r.state,
        current_turn: finished ? null : opponent?.player_id ?? null,
        undo: { used: undo?.used ?? [] }, // 대기 중인 무르기 신청은 착수로 무효화
        ...(finished && {
          status: "finished" as const,
          winner: r.draw ? "draw" : myId,
          finished_at: new Date().toISOString(),
        }),
      };

      setRoom((prev) => (prev ? { ...prev, ...update } : prev));
      const { data, error } = await supabase
        .from("game_rooms")
        .update(update)
        .eq("id", roomId)
        .eq("current_turn", myId)
        .select("id");

      if (error || !data || data.length === 0) {
        const { data: fresh } = await supabase.from("game_rooms").select("*").eq("id", roomId).maybeSingle();
        if (fresh) setRoom(fresh as SagmokRoomRow);
      }
    },
    [supabase, room, me, opponent, myId, roomId, undo, state],
  );

  // ---------- 무르기 ----------

  const lastMoveColor = state.moves.at(-1)?.c ?? null;
  const undoUsedByMe = (undo?.used ?? []).includes(myId);
  const canRequestUndo =
    room?.status === "playing" &&
    Boolean(me) &&
    lastMoveColor === me?.color &&
    !undoUsedByMe &&
    !undo?.by;

  const requestUndo = useCallback(async () => {
    if (!supabase || !room || !me || !opponent) return;
    const value: SagmokUndoState = { ...(undo ?? {}), by: myId, declined: undefined };
    setRoom((prev) => (prev ? { ...prev, undo: value } : prev));
    await supabase
      .from("game_rooms")
      .update({ undo: value })
      .eq("id", roomId)
      .eq("status", "playing")
      .eq("current_turn", opponent.player_id);
  }, [supabase, room, me, opponent, undo, myId, roomId]);

  const acceptUndo = useCallback(async () => {
    if (!supabase || !room || !me || !undo?.by) return;
    const moves = state.moves.slice(0, -1);
    const value: SagmokUndoState = { used: [...(undo.used ?? []), undo.by] };
    const update = { state: { moves }, current_turn: undo.by, undo: value };
    setRoom((prev) => (prev ? { ...prev, ...update } : prev));
    await supabase.from("game_rooms").update(update).eq("id", roomId).eq("current_turn", myId);
  }, [supabase, room, me, undo, myId, roomId, state]);

  const declineUndo = useCallback(async () => {
    if (!supabase || !room || !undo?.by) return;
    const value: SagmokUndoState = { used: undo.used ?? [], declined: undo.by };
    setRoom((prev) => (prev ? { ...prev, undo: value } : prev));
    await supabase.from("game_rooms").update({ undo: value }).eq("id", roomId);
  }, [supabase, room, undo, roomId]);

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
    const myNewColor: StoneColor = me.color === "b" ? "w" : "b";
    const oppNewColor: StoneColor = opponent.color === "b" ? "w" : "b";
    const blackId = myNewColor === "b" ? me.player_id : opponent.player_id;

    const { data: newRoom, error } = await supabase
      .from("game_rooms")
      .insert({
        game_type: "sagmok",
        status: "playing",
        state: { moves: [] },
        current_turn: blackId,
        rules: room.rules ?? DEFAULT_SAGMOK_RULES,
        undo: null,
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
        color: myNewColor,
      },
      {
        room_id: newRoom.id,
        player_id: opponent.player_id,
        user_id: opponent.user_id,
        nickname: opponent.nickname,
        color: oppNewColor,
      },
    ]);

    await supabase
      .from("game_rooms")
      .update({ rematch: { ...rematch, next_room_id: newRoom.id } })
      .eq("id", roomId);

    router.push(`/room/${newRoom.id}`);
  }, [supabase, room, me, opponent, rematch, roomId, router]);

  // 종료 시 기록 저장
  useEffect(() => {
    if (!room || room.status !== "finished" || !me) return;
    if (savedRef.current === room.id) return;
    savedRef.current = room.id;

    const record = {
      roomId: room.id,
      gameType: "sagmok" as const,
      result:
        room.winner === "draw" ? ("draw" as const)
        : room.winner === myId ? ("win" as const)
        : ("lose" as const),
      opponentNickname: opponent?.nickname ?? "?",
      moves: state.moves,
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
  }, [room, me, opponent, myId, supabase, state.moves]);

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

  const board = boardFromMoves(state.moves);
  const lastMove = state.moves.at(-1) ?? null;
  const finished = room.status === "finished";
  const myTurn = room.status === "playing" && room.current_turn === myId;
  const winnerPlayer = players.find((p) => p.player_id === room.winner) ?? null;

  const winLine =
    finished && room.winner !== "draw" && lastMove
      ? (checkWin(board, lastMove.x, lastMove.y)?.line ?? null)
      : null;

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
            {COLS}×{ROWS} · 4목
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
        {(["b", "w"] as const).map((c) => {
          const p = players.find((pl) => pl.color === c) ?? null;
          const isTurn = room.status === "playing" && p && room.current_turn === p.player_id;
          return (
            <div
              key={c}
              className={`flex flex-1 items-center gap-2 rounded-lg border px-4 py-2.5 transition ${
                isTurn ? "border-vermil bg-paper-deep shadow" : "border-mud/30"
              }`}
            >
              <span
                className={`h-4 w-4 shrink-0 rounded-full ${
                  c === "b" ? "bg-ink" : "border border-mud/60 bg-white"
                }`}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {p ? p.nickname : "대기 중…"}
                  {p && p.player_id === myId && (
                    <span className="ml-1 font-plex text-[10px] text-mud">(나)</span>
                  )}
                </p>
                <p className="font-plex text-[10px] text-mud">
                  {COLOR_LABEL[c]}
                  {isTurn ? " · 차례" : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <SagmokBoard
        board={board}
        lastMove={lastMove}
        winLine={winLine}
        previewColor={myTurn && me ? (me.color as StoneColor) : null}
        onDrop={drop}
      />

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
                  ? "당신 차례입니다 — 놓을 열을 클릭하세요"
                  : `${opponent?.nickname ?? "상대"}의 차례입니다`}
            </p>

            {me && opponent && opponentOffline && (
              <DisconnectBanner nickname={opponent.nickname} onForfeit={forceForfeit} />
            )}

            {/* 무르기 */}
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
                무르기를 신청했습니다 — {opponent?.nickname ?? "상대"}의 수락 대기 중…
              </p>
            )}
            {me && undo?.by && undo.by !== myId && (
              <div className="banner-in mt-3 rounded-lg border border-mud/30 bg-paper-deep px-4 py-3">
                <p className="text-sm">
                  <span className="font-semibold">{opponent?.nickname ?? "상대"}</span>
                  님이 무르기를 신청했습니다 — 허용하시겠습니까?
                </p>
                <div className="mt-2 flex justify-center gap-2">
                  <button
                    onClick={acceptUndo}
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
            {me && undo?.declined === myId && !undo?.by && (
              <p className="mt-3 font-plex text-xs text-mud">상대가 무르기를 거절했습니다.</p>
            )}
            {me && undoUsedByMe && !undo?.by && (
              <p className="mt-1 font-plex text-[10px] text-mud/70">무르기를 이미 사용했습니다.</p>
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
              {state.moves.length}수 · 기록이 저장되었습니다
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
                  님이 재대결을 신청했습니다. (흑/백 교대)
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

      <ChatWidget roomId={roomId} myId={myId} nickname={me?.nickname ?? null} />

      <NicknameModal
        open={needJoin}
        defaultValue={typeof window !== "undefined" ? getStoredNickname() : ""}
        title={players.length === 0 ? "사목 방을 만들었습니다 — 닉네임 입력" : "대국에 참가합니다 — 닉네임 입력"}
        onSubmit={join}
      />
      <RulesModal open={rulesModal.open} gameType="sagmok" onClose={rulesModal.close} />
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
