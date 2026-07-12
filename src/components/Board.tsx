"use client";

import { useState } from "react";
import {
  SIZE,
  STAR_POINTS,
  idx,
  type Board as BoardT,
  type Point,
  type StoneColor,
} from "@/games/omok/logic";
import { useCoarsePointer } from "@/lib/useCoarsePointer";

const PAD = 30;
const GAP = 40;
const W = PAD * 2 + GAP * (SIZE - 1); // 590

function px(v: number): number {
  return PAD + v * GAP;
}

interface BoardProps {
  board: BoardT;
  lastMove?: Point | null;
  winLine?: Point[] | null;
  /** 호버 시 미리보기로 보여줄 돌 색. null이면 착수 불가 상태 */
  previewColor?: StoneColor | null;
  onPlace?: (x: number, y: number) => void;
}

export default function Board({ board, lastMove, winLine, previewColor, onPlace }: BoardProps) {
  const [hover, setHover] = useState<Point | null>(null);
  const [selected, setSelected] = useState<Point | null>(null);
  const coarse = useCoarsePointer();

  const winSet = new Set((winLine ?? []).map((p) => idx(p.x, p.y)));
  const interactive = Boolean(previewColor && onPlace);
  const preview = coarse ? selected : hover;

  // 착수 가능 여부가 바뀌거나(내 차례가 아니게 됨) 판이 바뀌면(수가 두어짐) 대기 중인 선택을 지운다
  const [prevBoard, setPrevBoard] = useState(board);
  const [prevInteractive, setPrevInteractive] = useState(interactive);
  if (prevBoard !== board || prevInteractive !== interactive) {
    setPrevBoard(board);
    setPrevInteractive(interactive);
    setSelected(null);
  }

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${W}`}
        className="w-full max-w-[590px] select-none rounded-lg shadow-[0_10px_30px_rgba(26,22,20,0.25)]"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="오목판"
      >
        <defs>
          <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-board-hi)" />
            <stop offset="100%" stopColor="var(--color-board-lo)" />
          </linearGradient>
          <radialGradient id="stone-b" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#6b645c" />
            <stop offset="45%" stopColor="#2b2624" />
            <stop offset="100%" stopColor="#0d0b0a" />
          </radialGradient>
          <radialGradient id="stone-w" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f0e9da" />
            <stop offset="100%" stopColor="#c9bfa9" />
          </radialGradient>
        </defs>

        {/* 판 배경 */}
        <rect x="0" y="0" width={W} height={W} rx="10" fill="url(#wood)" />
        <rect
          x="4" y="4" width={W - 8} height={W - 8} rx="8"
          fill="none" stroke="rgba(122,111,92,0.35)" strokeWidth="1"
        />

        {/* 격자 */}
        {Array.from({ length: SIZE }, (_, i) => (
          <g key={i} stroke="#8a7a5f" strokeWidth={i === 0 || i === SIZE - 1 ? 1.4 : 0.8}>
            <line x1={px(0)} y1={px(i)} x2={px(SIZE - 1)} y2={px(i)} />
            <line x1={px(i)} y1={px(0)} x2={px(i)} y2={px(SIZE - 1)} />
          </g>
        ))}

        {/* 화점 */}
        {STAR_POINTS.map((p) => (
          <circle key={`${p.x}-${p.y}`} cx={px(p.x)} cy={px(p.y)} r="3.4" fill="#6d5f48" />
        ))}

        {/* 놓인 돌 */}
        {board.map((cell, i) => {
          if (!cell) return null;
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const isLast = lastMove && lastMove.x === x && lastMove.y === y;
          const inWin = winSet.has(i);
          return (
            <g key={`s-${x}-${y}`} className="stone-pop">
              <circle
                cx={px(x)} cy={px(y)} r={GAP * 0.44}
                fill={cell === "b" ? "url(#stone-b)" : "url(#stone-w)"}
                stroke={cell === "b" ? "#000" : "#b3a68d"}
                strokeWidth="0.8"
              />
              {inWin && (
                <circle
                  cx={px(x)} cy={px(y)} r={GAP * 0.44 + 2.5}
                  fill="none" stroke="var(--color-vermil)" strokeWidth="2.2"
                />
              )}
              {isLast && !inWin && (
                <circle cx={px(x)} cy={px(y)} r="4" fill="var(--color-vermil)" />
              )}
            </g>
          );
        })}

        {/* 호버(PC) 또는 탭 선택(터치) 미리보기 */}
        {interactive && preview && board[idx(preview.x, preview.y)] === null && (
          <circle
            cx={px(preview.x)} cy={px(preview.y)} r={GAP * 0.44}
            fill={previewColor === "b" ? "url(#stone-b)" : "url(#stone-w)"}
            opacity={coarse ? 0.55 : 0.45}
            stroke={coarse ? "var(--color-vermil)" : "none"}
            strokeWidth={coarse ? 2 : 0}
            strokeDasharray={coarse ? "4 3" : undefined}
            pointerEvents="none"
          />
        )}

        {/* 클릭/호버/탭 히트 영역 */}
        {interactive &&
          Array.from({ length: SIZE * SIZE }, (_, i) => {
            const x = i % SIZE;
            const y = Math.floor(i / SIZE);
            if (board[i] !== null) return null;
            return (
              <rect
                key={`h-${x}-${y}`}
                x={px(x) - GAP / 2} y={px(y) - GAP / 2}
                width={GAP} height={GAP}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHover({ x, y })}
                onClick={() => {
                  if (coarse) {
                    setSelected((prev) => (prev && prev.x === x && prev.y === y ? null : { x, y }));
                  } else {
                    onPlace?.(x, y);
                  }
                }}
              />
            );
          })}
      </svg>

      {coarse && interactive && selected && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center gap-2 border-t border-mud/30 bg-paper/95 p-3 shadow-[0_-4px_16px_rgba(26,22,20,0.15)] backdrop-blur">
          <button
            onClick={() => setSelected(null)}
            className="rounded border border-mud/40 px-5 py-2.5 text-sm text-ink-soft transition hover:border-ink"
          >
            취소
          </button>
          <button
            onClick={() => {
              onPlace?.(selected.x, selected.y);
              setSelected(null);
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
