"use client";

import { RESULT_LABEL, type GameRecord } from "@/lib/history";

const RESULT_COLOR: Record<GameRecord["result"], string> = {
  win: "text-vermil",
  lose: "text-mud",
  draw: "text-ink-soft",
};

export default function HistoryList({ records }: { records: GameRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="py-8 text-center font-plex text-sm text-mud">
        아직 기록이 없습니다. 첫 대국을 시작해 보세요.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-mud/20">
      {records.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <span className={`w-6 text-center text-lg font-bold ${RESULT_COLOR[r.result]}`}>
              {RESULT_LABEL[r.result]}
            </span>
            <div>
              <p className="text-sm">
                vs <span className="font-semibold">{r.opponentNickname || "?"}</span>
              </p>
              <p className="font-plex text-xs text-mud">
                {new Date(r.playedAt).toLocaleString("ko-KR", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
                {r.moves ? ` · ${r.moves.length}수` : ""}
              </p>
            </div>
          </div>
          <span className="font-plex text-[10px] uppercase tracking-widest text-mud">
            {r.gameType === "yut" ? "윷놀이"
              : r.gameType === "go" ? "바둑"
              : r.gameType === "othello" ? "오셀로"
              : r.gameType === "sagmok" ? "사목"
              : r.gameType === "memory" ? "카드 뒤집기"
              : "오목"}
          </span>
        </li>
      ))}
    </ul>
  );
}
