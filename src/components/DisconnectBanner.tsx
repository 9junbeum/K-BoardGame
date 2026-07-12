"use client";

import { useEffect, useState } from "react";

const FORFEIT_DELAY_MS = 10000;

/**
 * 상대가 접속을 끊었을 때 표시하는 배너. 마운트된 시점부터 10초가 지나야
 * "나가기" 버튼이 활성화된다 — 상대가 돌아오면 부모가 이 컴포넌트를 언마운트해
 * 타이머가 자동으로 취소되도록 되어 있다.
 */
export default function DisconnectBanner({
  nickname,
  onForfeit,
}: {
  nickname: string;
  onForfeit: () => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), FORFEIT_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="banner-in mt-3 rounded-lg border border-vermil/40 bg-paper-deep px-4 py-3 text-center">
      <p className="text-sm">
        <span className="font-semibold">{nickname}</span>님이 떠났습니다. 돌아오기까지 기다리는 중…
      </p>
      <button
        onClick={onForfeit}
        disabled={!ready}
        className="mt-2 rounded bg-vermil px-5 py-1.5 text-sm text-paper transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        나가기{!ready ? " (잠시 후 활성화)" : ""}
      </button>
    </div>
  );
}
