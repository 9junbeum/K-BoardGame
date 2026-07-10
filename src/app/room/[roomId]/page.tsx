"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import OmokRoom from "@/components/OmokRoom";
import YutRoom from "@/components/YutRoom";
import { getSupabase } from "@/lib/supabase";

/** 방의 game_type에 따라 오목/윷놀이 화면으로 분기 */
export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const supabase = useMemo(() => getSupabase(), []);
  const [gameType, setGameType] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // roomId 변경 시 렌더 단계 리셋
  const [prevRoomId, setPrevRoomId] = useState(roomId);
  if (prevRoomId !== roomId) {
    setPrevRoomId(roomId);
    setGameType(null);
    setNotFound(false);
  }

  useEffect(() => {
    if (!supabase || !roomId) return;
    let cancelled = false;
    supabase
      .from("game_rooms")
      .select("game_type")
      .eq("id", roomId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data) setNotFound(true);
        else setGameType(data.game_type as string);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, roomId]);

  if (!supabase) {
    return (
      <Center>
        <p className="text-ink-soft">실시간 대전을 하려면 Supabase 설정이 필요합니다.</p>
        <p className="mt-2 font-plex text-xs text-mud">
          .env.local 에 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY를 넣고 재시작하세요.
        </p>
        <Link href="/room/local" className="mt-6 inline-block text-vermil underline underline-offset-4">
          같은 화면 오목으로 이동
        </Link>
      </Center>
    );
  }

  if (notFound) {
    return (
      <Center>
        <p className="text-ink-soft">방을 찾을 수 없습니다.</p>
        <Link href="/" className="mt-4 inline-block text-vermil underline underline-offset-4">
          로비로 돌아가기
        </Link>
      </Center>
    );
  }

  if (!gameType) {
    return (
      <Center>
        <p className="font-plex text-sm text-mud">불러오는 중…</p>
      </Center>
    );
  }

  return gameType === "yut" ? <YutRoom roomId={roomId} /> : <OmokRoom roomId={roomId} />;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
      <div className="mt-20 text-center">{children}</div>
    </main>
  );
}
