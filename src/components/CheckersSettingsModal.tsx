"use client";

import { useState } from "react";
import Link from "next/link";
import { DEFAULT_CHECKERS_RULES, type CheckersRules } from "@/games/checkers/logic";
import type { FirstMove } from "@/games/omok/logic";

interface Props {
  open: boolean;
  creating?: boolean;
  onCreate: (rules: CheckersRules) => void;
  onClose: () => void;
}

const FIRST_MOVE_OPTIONS: { value: FirstMove; label: string; desc: string }[] = [
  { value: "random", label: "랜덤", desc: "동전 던지기" },
  { value: "host", label: "나", desc: "방장이 흑" },
  { value: "guest", label: "상대", desc: "참가자가 흑" },
];

export default function CheckersSettingsModal({ open, creating, onCreate, onClose }: Props) {
  const [firstMove, setFirstMove] = useState<FirstMove>(DEFAULT_CHECKERS_RULES.firstMove);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="banner-in w-full max-w-sm rounded-lg border border-mud/30 bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">체커 설정</h2>
        <p className="mt-1 font-plex text-xs text-mud">8×8판 · 강제 잡기 · 연속 잡기 · 킹 승격</p>

        {/* 흑선 */}
        <div className="mt-5">
          <p className="text-sm font-semibold">흑 (먼저 두는 사람)</p>
          <div className="mt-2 flex gap-2">
            {FIRST_MOVE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setFirstMove(o.value)}
                className={`flex-1 rounded border px-2 py-2 text-center transition ${
                  firstMove === o.value
                    ? "border-vermil bg-paper-deep shadow"
                    : "border-mud/30 opacity-70 hover:opacity-100"
                }`}
              >
                <span className="block text-sm">{o.label}</span>
                <span className="block font-plex text-[10px] text-mud">{o.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-mud/40 px-4 py-2.5 text-sm text-ink-soft transition hover:border-ink"
          >
            취소
          </button>
          <Link
            href="/room/local/checkers"
            className="flex-1 rounded border border-mud/40 px-4 py-2.5 text-center text-sm text-ink-soft transition hover:border-ink"
          >
            같은 화면
          </Link>
          <button
            onClick={() => onCreate({ firstMove })}
            disabled={creating}
            className="flex-1 rounded bg-ink px-4 py-2.5 text-sm text-paper transition hover:bg-ink-soft disabled:opacity-50"
          >
            {creating ? "만드는 중…" : "방 만들기"}
          </button>
        </div>
      </div>
    </div>
  );
}
