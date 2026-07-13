"use client";

import { useState, type KeyboardEvent } from "react";
import {
  COLS,
  dropRow,
  idx,
  ROWS,
  type Board as BoardT,
  type Point,
  type StoneColor,
} from "@/games/sagmok/logic";
import { useCoarsePointer } from "@/lib/useCoarsePointer";

const PAD = 34;
const GAP = 66;
const W = PAD * 2 + GAP * (COLS - 1);
const H = PAD * 2 + GAP * (ROWS - 1);

function px(v: number): number {
  return PAD + v * GAP;
}
function py(v: number): number {
  return PAD + v * GAP;
}

interface SagmokBoardProps {
  board: BoardT;
  lastMove?: Point | null;
  winLine?: Point[] | null;
  /** 호버 시 미리보기로 보여줄 돌 색. null이면 착수 불가 상태 */
  previewColor?: StoneColor | null;
  onDrop?: (x: number) => void;
}

export default function SagmokBoard({ board, lastMove, winLine, previewColor, onDrop }: SagmokBoardProps) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [kbCol, setKbCol] = useState<number | null>(null);
  const coarse = useCoarsePointer();

  const winSet = new Set((winLine ?? []).map((p) => idx(p.x, p.y)));
  const interactive = Boolean(previewColor && onDrop);
  const previewCol = kbCol ?? (coarse ? selectedCol : hoverCol);
  const previewRow = previewCol !== null ? dropRow(board, previewCol) : null;

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        setKbCol((c) => Math.max(0, (c ?? Math.floor(COLS / 2)) - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        setKbCol((c) => Math.min(COLS - 1, (c ?? Math.floor(COLS / 2)) + 1));
        break;
      case "Enter":
      case " ":
      case "ArrowDown":
        e.preventDefault();
        setKbCol((c) => {
          const col = c ?? Math.floor(COLS / 2);
          if (dropRow(board, col) !== null) onDrop?.(col);
          return col;
        });
        break;
      case "Escape":
        setKbCol(null);
        break;
    }
  };

  // 착수 가능 여부가 바뀌거나(내 차례가 아니게 됨) 판이 바뀌면(수가 두어짐) 대기 중인 선택을 지운다
  const [prevBoard, setPrevBoard] = useState(board);
  const [prevInteractive, setPrevInteractive] = useState(interactive);
  if (prevBoard !== board || prevInteractive !== interactive) {
    setPrevBoard(board);
    setPrevInteractive(interactive);
    setSelectedCol(null);
    setKbCol(null);
  }

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[560px] select-none rounded-lg shadow-[0_10px_30px_rgba(26,22,20,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-vermil"
        onMouseLeave={() => setHoverCol(null)}
        onKeyDown={onKeyDown}
        tabIndex={interactive ? 0 : -1}
        role="img"
        aria-label="사목판 — 좌우 화살표로 열 이동, Enter/Space/아래 화살표로 떨어뜨리기"
      >
        <defs>
          <linearGradient id="sg-wood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-board-hi)" />
            <stop offset="100%" stopColor="var(--color-board-lo)" />
          </linearGradient>
          <radialGradient id="sg-stone-b" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#6b645c" />
            <stop offset="45%" stopColor="#2b2624" />
            <stop offset="100%" stopColor="#0d0b0a" />
          </radialGradient>
          <radialGradient id="sg-stone-w" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f0e9da" />
            <stop offset="100%" stopColor="#c9bfa9" />
          </radialGradient>
        </defs>

        {/* 판 배경 */}
        <rect x="0" y="0" width={W} height={H} rx="10" fill="url(#sg-wood)" />
        <rect
          x="4" y="4" width={W - 8} height={H - 8} rx="8"
          fill="none" stroke="rgba(122,111,92,0.35)" strokeWidth="1"
        />

        {/* 열 강조(호버/선택) */}
        {interactive && previewCol !== null && (
          <rect
            x={px(previewCol) - GAP / 2} y="6"
            width={GAP} height={H - 12}
            fill="rgba(139,42,31,0.08)"
            pointerEvents="none"
          />
        )}

        {/* 소켓 + 돌 */}
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const x = i % COLS;
          const y = Math.floor(i / COLS);
          const cell = board[i];
          const isLast = lastMove && lastMove.x === x && lastMove.y === y;
          const inWin = winSet.has(i);
          return (
            <g key={`c-${x}-${y}`}>
              <circle cx={px(x)} cy={py(y)} r={GAP * 0.42} fill="rgba(26,22,20,0.12)" />
              {cell && (
                <g className="stone-pop">
                  <circle
                    cx={px(x)} cy={py(y)} r={GAP * 0.4}
                    fill={cell === "b" ? "url(#sg-stone-b)" : "url(#sg-stone-w)"}
                    stroke={cell === "b" ? "#000" : "#b3a68d"}
                    strokeWidth="0.8"
                  />
                  {inWin && (
                    <circle
                      cx={px(x)} cy={py(y)} r={GAP * 0.4 + 2.5}
                      fill="none" stroke="var(--color-vermil)" strokeWidth="2.2"
                    />
                  )}
                  {isLast && !inWin && (
                    <circle cx={px(x)} cy={py(y)} r="4" fill="var(--color-vermil)" />
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* 호버(PC) 또는 탭 선택(터치) 미리보기 — 실제로 떨어질 칸에 표시 */}
        {interactive && previewCol !== null && previewRow !== null && (
          <circle
            cx={px(previewCol)} cy={py(previewRow)} r={GAP * 0.4}
            fill={previewColor === "b" ? "url(#sg-stone-b)" : "url(#sg-stone-w)"}
            opacity={coarse ? 0.55 : 0.45}
            stroke={coarse ? "var(--color-vermil)" : "none"}
            strokeWidth={coarse ? 2 : 0}
            strokeDasharray={coarse ? "4 3" : undefined}
            pointerEvents="none"
          />
        )}

        {/* 열 클릭/호버/탭 히트 영역 — 가득 찬 열은 제외 */}
        {interactive &&
          Array.from({ length: COLS }, (_, x) => {
            if (dropRow(board, x) === null) return null;
            return (
              <rect
                key={`h-${x}`}
                x={px(x) - GAP / 2} y="0"
                width={GAP} height={H}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverCol(x)}
                onClick={() => {
                  if (coarse) {
                    setSelectedCol((prev) => (prev === x ? null : x));
                  } else {
                    onDrop?.(x);
                  }
                }}
              />
            );
          })}
      </svg>

      {!coarse && interactive && (
        <p className="mt-1.5 font-plex text-[10px] text-mud">
          키보드: 좌우 화살표로 열 이동 · Enter/Space로 떨어뜨리기
        </p>
      )}

      {coarse && interactive && selectedCol !== null && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center gap-2 border-t border-mud/30 bg-paper/95 p-3 shadow-[0_-4px_16px_rgba(26,22,20,0.15)] backdrop-blur">
          <button
            onClick={() => setSelectedCol(null)}
            className="rounded border border-mud/40 px-5 py-2.5 text-sm text-ink-soft transition hover:border-ink"
          >
            취소
          </button>
          <button
            onClick={() => {
              onDrop?.(selectedCol);
              setSelectedCol(null);
            }}
            className="rounded bg-vermil px-8 py-2.5 text-sm text-paper shadow transition hover:opacity-85"
          >
            여기에 놓기
          </button>
        </div>
      )}
    </>
  );
}
