"use client";

import { useState } from "react";
import Link from "next/link";
import { DEFAULT_YUT_RULES, type YutRules } from "@/games/yut/logic";

interface Props {
  open: boolean;
  creating?: boolean;
  onCreate: (rules: YutRules) => void;
  onClose: () => void;
}

export default function YutSettingsModal({ open, creating, onCreate, onClose }: Props) {
  const [pieceCount, setPieceCount] = useState(DEFAULT_YUT_RULES.pieceCount);
  const [backdo, setBackdo] = useState(DEFAULT_YUT_RULES.backdo);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="banner-in w-full max-w-sm rounded-lg border border-mud/30 bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">윷놀이 설정</h2>
        <p className="mt-1 font-plex text-xs text-mud">2~4명 · 링크로 참가 · 방장이 시작</p>

        <div className="mt-5">
          <p className="text-sm font-semibold">플레이어당 말 개수</p>
          <div className="mt-2 flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setPieceCount(n)}
                className={`flex-1 rounded border px-2 py-2 text-center transition ${
                  pieceCount === n
                    ? "border-vermil bg-paper-deep shadow"
                    : "border-mud/30 opacity-70 hover:opacity-100"
                }`}
              >
                <span className="block text-sm">{n}개</span>
                <span className="block font-plex text-[10px] text-mud">
                  {n === 4 ? "정식" : "빠른 판"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 flex cursor-pointer items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">빽도</p>
            <p className="font-plex text-[11px] leading-relaxed text-mud">
              표식 가락 하나만 배가 나오면 한 칸 뒤로
            </p>
          </div>
          <input
            type="checkbox"
            checked={backdo}
            onChange={(e) => setBackdo(e.target.checked)}
            className="h-5 w-5 accent-[#8b2a1f]"
          />
        </label>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-mud/40 px-4 py-2.5 text-sm text-ink-soft transition hover:border-ink"
          >
            취소
          </button>
          <Link
            href="/room/local/yut"
            className="flex-1 rounded border border-mud/40 px-4 py-2.5 text-center text-sm text-ink-soft transition hover:border-ink"
          >
            같은 화면
          </Link>
          <button
            onClick={() => onCreate({ pieceCount, backdo })}
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
