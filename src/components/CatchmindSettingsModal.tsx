"use client";

import { useState } from "react";
import {
  DEFAULT_CATCHMIND_RULES,
  DRAW_SECONDS_OPTIONS,
  TARGET_SCORE_OPTIONS,
  type CatchmindRules,
} from "@/games/catchmind/logic";

interface Props {
  open: boolean;
  creating?: boolean;
  onCreate: (rules: CatchmindRules) => void;
  onClose: () => void;
}

export default function CatchmindSettingsModal({ open, creating, onCreate, onClose }: Props) {
  const [targetScore, setTargetScore] = useState(DEFAULT_CATCHMIND_RULES.targetScore);
  const [drawSeconds, setDrawSeconds] = useState(DEFAULT_CATCHMIND_RULES.drawSeconds);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="banner-in w-full max-w-sm rounded-lg border border-mud/30 bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">캐치마인드 설정</h2>
        <p className="mt-1 font-plex text-xs text-mud">
          2~4인 · 그림을 그리고 채팅으로 맞히는 게임
        </p>

        {/* 목표 점수 */}
        <div className="mt-5">
          <p className="text-sm font-semibold">목표 점수</p>
          <p className="font-plex text-[11px] leading-relaxed text-mud">
            먼저 이 점수에 도달한 사람이 승리합니다
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TARGET_SCORE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setTargetScore(s)}
                className={`rounded border px-2 py-2 text-center text-sm transition ${
                  targetScore === s
                    ? "border-vermil bg-paper-deep shadow"
                    : "border-mud/30 opacity-70 hover:opacity-100"
                }`}
              >
                {s}점
              </button>
            ))}
          </div>
        </div>

        {/* 제한시간 */}
        <div className="mt-5">
          <p className="text-sm font-semibold">그리기 제한시간</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {DRAW_SECONDS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setDrawSeconds(s)}
                className={`rounded border px-2 py-2 text-center text-sm transition ${
                  drawSeconds === s
                    ? "border-vermil bg-paper-deep shadow"
                    : "border-mud/30 opacity-70 hover:opacity-100"
                }`}
              >
                {s}초
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
          <button
            onClick={() => onCreate({ targetScore, drawSeconds })}
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
