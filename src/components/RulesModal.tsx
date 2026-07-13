"use client";

import { GAME_RULES, type GameType } from "@/lib/gameRules";

interface Props {
  open: boolean;
  gameType: GameType;
  onClose: () => void;
}

/** 게임 시작 전(또는 언제든) 규칙을 보여주는 모달 — 건너뛰기 가능 */
export default function RulesModal({ open, gameType, onClose }: Props) {
  if (!open) return null;
  const info = GAME_RULES[gameType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
      <div className="banner-in w-full max-w-md rounded-lg border border-mud/30 bg-paper p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{info.title}</h2>
        <ul className="mt-4 space-y-2.5 font-plex text-xs leading-relaxed text-ink-soft">
          {info.rules.map((rule, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 text-mud">·</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-mud/40 px-4 py-1.5 font-plex text-xs text-ink-soft transition hover:border-ink"
          >
            건너뛰기
          </button>
          <button
            onClick={onClose}
            className="rounded bg-ink px-4 py-1.5 font-plex text-xs text-paper transition hover:bg-ink-soft"
          >
            확인했어요
          </button>
        </div>
      </div>
    </div>
  );
}
