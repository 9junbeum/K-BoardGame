"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import HistoryList from "@/components/HistoryList";
import { loadLocalHistory, loadServerHistory, type GameRecord } from "@/lib/history";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";

export default function LobbyPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [creating, setCreating] = useState(false);
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

  const startGame = useCallback(async () => {
    setError(null);
    const supabase = getSupabase();
    if (!supabase) {
      // Supabase 미설정 → 같은 화면 대국으로
      router.push("/room/local");
      return;
    }
    setCreating(true);
    const { data, error: err } = await supabase
      .from("game_rooms")
      .insert({ game_type: "omok", status: "waiting", state: { moves: [] } })
      .select("id")
      .single();
    setCreating(false);
    if (err || !data) {
      setError("방을 만들지 못했습니다. Supabase 설정을 확인해 주세요.");
      return;
    }
    router.push(`/room/${data.id}`);
  }, [router]);

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
        <h1 className="text-5xl font-bold leading-tight tracking-tight">오목</h1>
        <p className="mx-auto mt-4 max-w-md text-ink-soft">
          멀리 있는 친구와, 가입 없이 링크 하나로.
          <br />
          돌을 놓는 순간 상대의 화면에도 놓입니다.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={startGame}
            disabled={creating}
            className="rounded-md bg-ink px-10 py-3.5 text-lg text-paper shadow-lg transition hover:bg-ink-soft disabled:opacity-50"
          >
            {creating ? "방을 만드는 중…" : "오목 시작하기"}
          </button>
          <button
            onClick={() => router.push("/room/local")}
            className="font-plex text-xs text-mud underline-offset-4 transition hover:text-ink hover:underline"
          >
            같은 화면에서 둘이 두기
          </button>
          {!supabaseEnabled && (
            <p className="mt-2 max-w-sm font-plex text-xs leading-relaxed text-vermil">
              Supabase가 아직 설정되지 않아 실시간 대전은 비활성 상태입니다. 같은 화면
              대국으로 게임을 즐길 수 있습니다. (.env.local 설정 후 활성화)
            </p>
          )}
          {error && <p className="font-plex text-xs text-vermil">{error}</p>}
        </div>
      </section>

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

      <footer className="mt-auto pt-12 text-center font-plex text-[10px] uppercase tracking-widest text-mud">
        omok online — a quiet board for two
      </footer>
    </main>
  );
}
