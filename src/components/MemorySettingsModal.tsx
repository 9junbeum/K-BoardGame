"use client";

import { useState } from "react";
import {
  DEFAULT_MEMORY_RULES,
  GRID_DIMS,
  GRID_SIZES,
  TURN_SECONDS_OPTIONS,
  type GridSize,
  type MemoryRules,
} from "@/games/memory/logic";

interface Props {
  open: boolean;
  creating?: boolean;
  onCreate: (rules: MemoryRules) => void;
  onClose: () => void;
}

export default function MemorySettingsModal({ open, creating, onCreate, onClose }: Props) {
  const [grid, setGrid] = useState<GridSize>(DEFAULT_MEMORY_RULES.grid);
  const [turnSeconds, setTurnSeconds] = useState(DEFAULT_MEMORY_RULES.turnSeconds);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="banner-in w-full max-w-sm rounded-lg border border-mud/30 bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">카드 뒤집기 설정</h2>
        <p className="mt-1 font-plex text-xs text-mud">같은 카드 2장을 찾는 짝 맞추기</p>

        {/* 배열 크기 */}
        <div className="mt-5">
          <p className="text-sm font-semibold">카드 배열</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {GRID_SIZES.map((g) => (
              <button
                key={g}
                onClick={() => setGrid(g)}
                className={`rounded border px-2 py-2 text-center transition ${
                  grid === g
                    ? "border-vermil bg-paper-deep shadow"
                    : "border-mud/30 opacity-70 hover:opacity-100"
                }`}
              >
                <span className="block text-sm">{g}</span>
                <span className="block font-plex text-[10px] text-mud">
                  {GRID_DIMS[g].rows * GRID_DIMS[g].cols}장
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 턴 제한 시간 */}
        <div className="mt-5">
          <p className="text-sm font-semibold">턴 제한 시간</p>
          <p className="font-plex text-[11px] leading-relaxed text-mud">
            시간 안에 카드를 고르지 않으면 자동으로 상대에게 차례가 넘어갑니다
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {TURN_SECONDS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setTurnSeconds(s)}
                className={`rounded border px-2 py-2 text-center text-sm transition ${
                  turnSeconds === s
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
            onClick={() => onCreate({ grid, turnSeconds })}
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
