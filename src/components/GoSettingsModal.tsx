"use client";

import { useState } from "react";
import { DEFAULT_GO_RULES, type BoardSize, type GoRules } from "@/games/go/logic";
import type { FirstMove } from "@/games/omok/logic";

interface Props {
  open: boolean;
  creating?: boolean;
  onCreate: (rules: GoRules) => void;
  onClose: () => void;
}

const BOARD_SIZES: { value: BoardSize; label: string; desc: string }[] = [
  { value: 9, label: "9×9", desc: "빠른 판" },
  { value: 13, label: "13×13", desc: "중간 판" },
  { value: 19, label: "19×19", desc: "정규 판" },
];

const FIRST_MOVE_OPTIONS: { value: FirstMove; label: string; desc: string }[] = [
  { value: "random", label: "랜덤", desc: "동전 던지기" },
  { value: "host", label: "나", desc: "방장이 흑" },
  { value: "guest", label: "상대", desc: "참가자가 흑" },
];

export default function GoSettingsModal({ open, creating, onCreate, onClose }: Props) {
  const [boardSize, setBoardSize] = useState<BoardSize>(DEFAULT_GO_RULES.boardSize);
  const [komi, setKomi] = useState(DEFAULT_GO_RULES.komi);
  const [firstMove, setFirstMove] = useState<FirstMove>(DEFAULT_GO_RULES.firstMove);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={onClose}>
      <div
        className="banner-in w-full max-w-sm rounded-lg border border-mud/30 bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">바둑 설정</h2>
        <p className="mt-1 font-plex text-xs text-mud">방을 만들기 전에 규칙을 정하세요.</p>

        {/* 판 크기 */}
        <div className="mt-5">
          <p className="text-sm font-semibold">판 크기</p>
          <div className="mt-2 flex gap-2">
            {BOARD_SIZES.map((o) => (
              <button
                key={o.value}
                onClick={() => setBoardSize(o.value)}
                className={`flex-1 rounded border px-2 py-2 text-center transition ${
                  boardSize === o.value
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

        {/* 덤 */}
        <div className="mt-5">
          <p className="text-sm font-semibold">덤 (komi)</p>
          <p className="font-plex text-[11px] leading-relaxed text-mud">
            선공(흑) 유리함을 보정하기 위해 백에게 더하는 점수 — 지역계수 기준 보통 6.5
          </p>
          <input
            type="number"
            step="0.5"
            value={komi}
            onChange={(e) => setKomi(Number(e.target.value))}
            className="mt-2 w-24 rounded border border-mud/40 bg-paper px-3 py-1.5 text-sm text-ink-soft"
          />
        </div>

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
          <button
            onClick={() => onCreate({ boardSize, komi, firstMove })}
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
