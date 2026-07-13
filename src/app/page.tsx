"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import CheckersSettingsModal from "@/components/CheckersSettingsModal";
import GoSettingsModal from "@/components/GoSettingsModal";
import HistoryList from "@/components/HistoryList";
import KakaoAdFit from "@/components/KakaoAdFit";
import MemorySettingsModal from "@/components/MemorySettingsModal";
import OthelloSettingsModal from "@/components/OthelloSettingsModal";
import RoomSettingsModal from "@/components/RoomSettingsModal";
import SagmokSettingsModal from "@/components/SagmokSettingsModal";
import YutSettingsModal from "@/components/YutSettingsModal";
import { createCheckersState, type CheckersRules } from "@/games/checkers/logic";
import { createGoState, type GoRules } from "@/games/go/logic";
import { createMemoryState, type MemoryRules } from "@/games/memory/logic";
import type { Rules } from "@/games/omok/logic";
import { createOthelloState, type OthelloRules } from "@/games/othello/logic";
import type { SagmokRules } from "@/games/sagmok/logic";
import type { YutRules } from "@/games/yut/logic";
import { loadLocalHistory, loadServerHistory, type GameRecord } from "@/lib/history";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";

export default function LobbyPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showYutSettings, setShowYutSettings] = useState(false);
  const [showGoSettings, setShowGoSettings] = useState(false);
  const [showOthelloSettings, setShowOthelloSettings] = useState(false);
  const [showSagmokSettings, setShowSagmokSettings] = useState(false);
  const [showMemorySettings, setShowMemorySettings] = useState(false);
  const [showCheckersSettings, setShowCheckersSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 인증 상태 구독
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // 기록 로드 (로그인: 서버 / 익명: localStorage)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      const supabase = getSupabase();
      const recs =
        session && supabase
          ? await loadServerHistory(supabase, session.user.id).catch(() => [])
          : loadLocalHistory();
      if (!cancelled) setRecords(recs);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const startGame = useCallback(() => {
    setError(null);
    if (!supabaseEnabled) {
      // Supabase 미설정 → 같은 화면 대국으로
      router.push("/room/local");
      return;
    }
    setShowSettings(true);
  }, [router]);

  const createRoom = useCallback(
    async (rules: Rules) => {
      const supabase = getSupabase();
      if (!supabase) return;
      setCreating(true);
      const { data, error: err } = await supabase
        .from("game_rooms")
        .insert({ game_type: "omok", status: "waiting", state: { moves: [] }, rules })
        .select("id")
        .single();
      setCreating(false);
      if (err || !data) {
        setShowSettings(false);
        setError("방을 만들지 못했습니다. Supabase 마이그레이션/설정을 확인해 주세요.");
        return;
      }
      router.push(`/room/${data.id}`);
    },
    [router],
  );

  const createYutRoom = useCallback(
    async (rules: YutRules) => {
      const supabase = getSupabase();
      if (!supabase) return;
      setCreating(true);
      const { data, error: err } = await supabase
        .from("game_rooms")
        .insert({ game_type: "yut", status: "waiting", state: {}, rules })
        .select("id")
        .single();
      setCreating(false);
      if (err || !data) {
        setShowYutSettings(false);
        setError("방을 만들지 못했습니다. Supabase 마이그레이션/설정을 확인해 주세요.");
        return;
      }
      router.push(`/room/${data.id}`);
    },
    [router],
  );

  const createGoRoom = useCallback(
    async (rules: GoRules) => {
      const supabase = getSupabase();
      if (!supabase) return;
      setCreating(true);
      const { data, error: err } = await supabase
        .from("game_rooms")
        .insert({ game_type: "go", status: "waiting", state: createGoState(), rules })
        .select("id")
        .single();
      setCreating(false);
      if (err || !data) {
        setShowGoSettings(false);
        setError("방을 만들지 못했습니다. Supabase 마이그레이션/설정을 확인해 주세요.");
        return;
      }
      router.push(`/room/${data.id}`);
    },
    [router],
  );

  const createOthelloRoom = useCallback(
    async (rules: OthelloRules) => {
      const supabase = getSupabase();
      if (!supabase) return;
      setCreating(true);
      const { data, error: err } = await supabase
        .from("game_rooms")
        .insert({ game_type: "othello", status: "waiting", state: createOthelloState(), rules })
        .select("id")
        .single();
      setCreating(false);
      if (err || !data) {
        setShowOthelloSettings(false);
        setError("방을 만들지 못했습니다. Supabase 마이그레이션/설정을 확인해 주세요.");
        return;
      }
      router.push(`/room/${data.id}`);
    },
    [router],
  );

  const createSagmokRoom = useCallback(
    async (rules: SagmokRules) => {
      const supabase = getSupabase();
      if (!supabase) return;
      setCreating(true);
      const { data, error: err } = await supabase
        .from("game_rooms")
        .insert({ game_type: "sagmok", status: "waiting", state: { moves: [] }, rules })
        .select("id")
        .single();
      setCreating(false);
      if (err || !data) {
        setShowSagmokSettings(false);
        setError("방을 만들지 못했습니다. Supabase 마이그레이션/설정을 확인해 주세요.");
        return;
      }
      router.push(`/room/${data.id}`);
    },
    [router],
  );

  const createMemoryRoom = useCallback(
    async (rules: MemoryRules) => {
      const supabase = getSupabase();
      if (!supabase) return;
      setCreating(true);
      const { data, error: err } = await supabase
        .from("game_rooms")
        .insert({
          game_type: "memory",
          status: "waiting",
          state: createMemoryState(rules.grid, rules.turnSeconds),
          rules,
        })
        .select("id")
        .single();
      setCreating(false);
      if (err || !data) {
        setShowMemorySettings(false);
        setError("방을 만들지 못했습니다. Supabase 마이그레이션/설정을 확인해 주세요.");
        return;
      }
      router.push(`/room/${data.id}`);
    },
    [router],
  );

  const createCheckersRoom = useCallback(
    async (rules: CheckersRules) => {
      const supabase = getSupabase();
      if (!supabase) return;
      setCreating(true);
      const { data, error: err } = await supabase
        .from("game_rooms")
        .insert({ game_type: "checkers", status: "waiting", state: createCheckersState(), rules })
        .select("id")
        .single();
      setCreating(false);
      if (err || !data) {
        setShowCheckersSettings(false);
        setError("방을 만들지 못했습니다. Supabase 마이그레이션/설정을 확인해 주세요.");
        return;
      }
      router.push(`/room/${data.id}`);
    },
    [router],
  );

  const signIn = useCallback(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(() => {
    getSupabase()?.auth.signOut();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-lg text-paper">
            五
          </span>
          <span className="font-plex text-xs uppercase tracking-[0.25em] text-mud">
            omok online
          </span>
        </div>
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="font-plex text-xs text-ink-soft">{session.user.email}</span>
              <button
                onClick={signOut}
                className="rounded border border-mud/40 px-3 py-1.5 font-plex text-xs text-ink-soft transition hover:border-ink"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <span className="font-plex text-xs text-mud">익명 모드</span>
              {supabaseEnabled && (
                <button
                  onClick={signIn}
                  className="rounded border border-mud/40 px-3 py-1.5 font-plex text-xs text-ink-soft transition hover:border-ink"
                >
                  구글 로그인
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* 히어로 */}
      <section className="mt-16 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          오목 · 윷놀이 · 바둑 · 오셀로 · 사목 · 카드 뒤집기 · 체커
        </h1>
        <p className="mx-auto mt-4 max-w-md text-ink-soft">
          멀리 있는 친구와, 가입 없이 링크 하나로.
          <br />
          수를 두는 순간 상대의 화면에도 그대로.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={startGame}
              disabled={creating}
              className="rounded-md bg-ink px-8 py-3.5 text-lg text-paper shadow-lg transition hover:bg-ink-soft disabled:opacity-50"
            >
              오목
            </button>
            {supabaseEnabled && (
              <button
                onClick={() => setShowYutSettings(true)}
                disabled={creating}
                className="rounded-md bg-vermil px-8 py-3.5 text-lg text-paper shadow-lg transition hover:opacity-85 disabled:opacity-50"
              >
                윷놀이
                <span className="ml-1.5 font-plex text-xs opacity-80">2~4인</span>
              </button>
            )}
            {supabaseEnabled && (
              <button
                onClick={() => setShowGoSettings(true)}
                disabled={creating}
                className="rounded-md border border-ink px-8 py-3.5 text-lg text-ink shadow-lg transition hover:bg-paper-deep disabled:opacity-50"
              >
                바둑
              </button>
            )}
            {supabaseEnabled && (
              <button
                onClick={() => setShowOthelloSettings(true)}
                disabled={creating}
                className="rounded-md border border-vermil px-8 py-3.5 text-lg text-vermil shadow-lg transition hover:bg-paper-deep disabled:opacity-50"
              >
                오셀로
              </button>
            )}
            {supabaseEnabled && (
              <button
                onClick={() => setShowSagmokSettings(true)}
                disabled={creating}
                className="rounded-md border border-mud/50 px-8 py-3.5 text-lg text-ink-soft shadow-lg transition hover:bg-paper-deep disabled:opacity-50"
              >
                사목
              </button>
            )}
            {supabaseEnabled && (
              <button
                onClick={() => setShowMemorySettings(true)}
                disabled={creating}
                className="rounded-md bg-ink-soft px-8 py-3.5 text-lg text-paper shadow-lg transition hover:opacity-85 disabled:opacity-50"
              >
                카드 뒤집기
              </button>
            )}
            {supabaseEnabled && (
              <button
                onClick={() => setShowCheckersSettings(true)}
                disabled={creating}
                className="rounded-md border border-ink-soft px-8 py-3.5 text-lg text-ink-soft shadow-lg transition hover:bg-paper-deep disabled:opacity-50"
              >
                체커
              </button>
            )}
          </div>
          {!supabaseEnabled && (
            <p className="mt-2 max-w-sm font-plex text-xs leading-relaxed text-vermil">
              Supabase가 아직 설정되지 않아 실시간 대전은 비활성 상태입니다. 같은 화면
              대국으로 게임을 즐길 수 있습니다. (.env.local 설정 후 활성화)
            </p>
          )}
          {error && <p className="font-plex text-xs text-vermil">{error}</p>}
        </div>
      </section>

      {/* 광고 */}
      <div className="mt-12">
        <KakaoAdFit adUnit="DAN-DXVo1uxzwvIXqjLT" width={320} height={100} />
      </div>

      {/* 기록 */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-ink/20 pb-2">
          <h2 className="text-lg font-semibold">최근 대국</h2>
          <span className="font-plex text-[10px] uppercase tracking-widest text-mud">
            {session ? "server" : "local"}
          </span>
        </div>
        {!session && (
          <div className="mt-3 rounded border border-mud/30 bg-paper-deep px-4 py-3 font-plex text-xs leading-relaxed text-ink-soft">
            익명 모드입니다. 기록은 이 브라우저에만 저장되며, 캐시 삭제·시크릿 모드·다른
            기기에서는 사라집니다.
            {supabaseEnabled && " 구글 로그인하면 기록이 영구 보관됩니다."}
          </div>
        )}
        <HistoryList records={records} />
      </section>

      <footer className="mt-auto flex flex-col items-center gap-2 pt-12 text-center font-plex text-[10px] uppercase tracking-widest text-mud">
        <span>omok online — a quiet board for two</span>
        <Link href="/privacy" className="normal-case tracking-normal underline-offset-4 hover:text-ink hover:underline">
          개인정보처리방침
        </Link>
      </footer>

      <RoomSettingsModal
        open={showSettings}
        creating={creating}
        onCreate={createRoom}
        onClose={() => setShowSettings(false)}
      />
      <YutSettingsModal
        open={showYutSettings}
        creating={creating}
        onCreate={createYutRoom}
        onClose={() => setShowYutSettings(false)}
      />
      <GoSettingsModal
        open={showGoSettings}
        creating={creating}
        onCreate={createGoRoom}
        onClose={() => setShowGoSettings(false)}
      />
      <OthelloSettingsModal
        open={showOthelloSettings}
        creating={creating}
        onCreate={createOthelloRoom}
        onClose={() => setShowOthelloSettings(false)}
      />
      <SagmokSettingsModal
        open={showSagmokSettings}
        creating={creating}
        onCreate={createSagmokRoom}
        onClose={() => setShowSagmokSettings(false)}
      />
      <MemorySettingsModal
        open={showMemorySettings}
        creating={creating}
        onCreate={createMemoryRoom}
        onClose={() => setShowMemorySettings(false)}
      />
      <CheckersSettingsModal
        open={showCheckersSettings}
        creating={creating}
        onCreate={createCheckersRoom}
        onClose={() => setShowCheckersSettings(false)}
      />
    </main>
  );
}
