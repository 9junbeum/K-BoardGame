"use client";

import { useState } from "react";
import {
  idx,
  SIZE,
  STAR_POINTS,
  type Board as BoardT,
  type Point,
  type StoneColor,
} from "@/games/othello/logic";
import { useCoarsePointer } from "@/lib/useCoarsePointer";

const PAD = 26;
const GAP = 62;
const W = PAD * 2 + GAP * (SIZE - 1);

function px(v: number): number {
  return PAD + v * GAP;
}

interface OthelloBoardProps {
  board: BoardT;
  lastMove?: Point | null;
  /** 지금 둘 수 있는 자리들. interactive일 때만 의미가 있다 */
  legalMoves?: Point[];
  /** 호버 시 미리보기로 보여줄 돌 색. null이면 착수 불가 상태 */
  previewColor?: StoneColor | null;
  onPlace?: (x: number, y: number) => void;
}

export default function OthelloBoard({
  board,
  lastMove,
  legalMoves,
  previewColor,
  onPlace,
}: OthelloBoardProps) {
  const [hover, setHover] = useState<Point | null>(null);
  const [selected, setSelected] = useState<Point | null>(null);
  const coarse = useCoarsePointer();

  const interactive = Boolean(previewColor && onPlace);
  const legal = interactive ? (legalMoves ?? []) : [];
  const legalSet = new Set(legal.map((p) => idx(p.x, p.y)));
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
        className="w-full max-w-[560px] select-none rounded-lg shadow-[0_10px_30px_rgba(26,22,20,0.25)]"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="오셀로판"
      >
        <defs>
          <linearGradient id="oth-wood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-board-hi)" />
            <stop offset="100%" stopColor="var(--color-board-lo)" />
          </linearGradient>
          <radialGradient id="oth-stone-b" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#6b645c" />
            <stop offset="45%" stopColor="#2b2624" />
            <stop offset="100%" stopColor="#0d0b0a" />
          </radialGradient>
          <radialGradient id="oth-stone-w" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f0e9da" />
            <stop offset="100%" stopColor="#c9bfa9" />
          </radialGradient>
        </defs>

        {/* 판 배경 */}
        <rect x="0" y="0" width={W} height={W} rx="10" fill="url(#oth-wood)" />
        <rect
          x="4" y="4" width={W - 8} height={W - 8} rx="8"
          fill="none" stroke="rgba(122,111,92,0.35)" strokeWidth="1"
        />

        {/* 칸 구분선 (8×8 칸 격자) */}
        {Array.from({ length: SIZE + 1 }, (_, i) => (
          <g key={i} stroke="#8a7a5f" strokeWidth={i === 0 || i === SIZE ? 1.4 : 0.8}>
            <line
              x1={PAD - GAP / 2} y1={PAD - GAP / 2 + i * GAP}
              x2={PAD - GAP / 2 + SIZE * GAP} y2={PAD - GAP / 2 + i * GAP}
            />
            <line
              x1={PAD - GAP / 2 + i * GAP} y1={PAD - GAP / 2}
              x2={PAD - GAP / 2 + i * GAP} y2={PAD - GAP / 2 + SIZE * GAP}
            />
          </g>
        ))}

        {/* 화점 */}
        {STAR_POINTS.map((p) => (
          <circle key={`${p.x}-${p.y}`} cx={px(p.x)} cy={px(p.y)} r="3.2" fill="#6d5f48" />
        ))}

        {/* 놓인 돌 */}
        {board.map((cell, i) => {
          if (!cell) return null;
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const isLast = lastMove && lastMove.x === x && lastMove.y === y;
          return (
            <g key={`s-${x}-${y}`} className="stone-pop">
              <circle
                cx={px(x)} cy={px(y)} r={GAP * 0.42}
                fill={cell === "b" ? "url(#oth-stone-b)" : "url(#oth-stone-w)"}
                stroke={cell === "b" ? "#000" : "#b3a68d"}
                strokeWidth="0.8"
              />
              {isLast && (
                <circle cx={px(x)} cy={px(y)} r="4" fill="var(--color-vermil)" />
              )}
            </g>
          );
        })}

        {/* 둘 수 있는 자리 표시 */}
        {legal.map((p) => {
          if (preview && preview.x === p.x && preview.y === p.y) return null;
          return (
            <circle
              key={`legal-${p.x}-${p.y}`}
              cx={px(p.x)} cy={px(p.y)} r={GAP * 0.1}
              fill="var(--color-mud)"
              opacity="0.5"
              pointerEvents="none"
            />
          );
        })}

        {/* 호버(PC) 또는 탭 선택(터치) 미리보기 */}
        {preview && legalSet.has(idx(preview.x, preview.y)) && (
          <circle
            cx={px(preview.x)} cy={px(preview.y)} r={GAP * 0.42}
            fill={previewColor === "b" ? "url(#oth-stone-b)" : "url(#oth-stone-w)"}
            opacity={coarse ? 0.55 : 0.45}
            stroke={coarse ? "var(--color-vermil)" : "none"}
            strokeWidth={coarse ? 2 : 0}
            strokeDasharray={coarse ? "4 3" : undefined}
            pointerEvents="none"
          />
        )}

        {/* 클릭/호버/탭 히트 영역 — 둘 수 있는 자리만 반응 */}
        {legal.map((p) => (
          <rect
            key={`h-${p.x}-${p.y}`}
            x={px(p.x) - GAP / 2} y={px(p.y) - GAP / 2}
            width={GAP} height={GAP}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHover(p)}
            onClick={() => {
              if (coarse) {
                setSelected((prev) => (prev && prev.x === p.x && prev.y === p.y ? null : p));
              } else {
                onPlace?.(p.x, p.y);
              }
            }}
          />
        ))}
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
