"use client";

import { useState } from "react";
import {
  idx,
  starPoints,
  type Board as BoardT,
  type BoardSize,
  type Point,
  type StoneColor,
} from "@/games/go/logic";
import { useBoardKeyboardNav } from "@/lib/useBoardKeyboardNav";
import { useCoarsePointer } from "@/lib/useCoarsePointer";

const PAD = 24;
const TARGET = 560;

interface GoBoardProps {
  board: BoardT;
  size: BoardSize;
  lastMove?: Point | null;
  /** 호버 시 미리보기로 보여줄 돌 색. null이면 착수 불가 상태 */
  previewColor?: StoneColor | null;
  onPlace?: (x: number, y: number) => void;
  /** 계가(사석 표시) 단계 — true면 돌 클릭으로 죽은 돌 그룹을 토글한다 */
  deadMode?: boolean;
  deadSet?: Set<number>;
  onToggleDead?: (pos: number) => void;
}

export default function GoBoard({
  board,
  size,
  lastMove,
  previewColor,
  onPlace,
  deadMode,
  deadSet,
  onToggleDead,
}: GoBoardProps) {
  const [hover, setHover] = useState<Point | null>(null);
  const [selected, setSelected] = useState<Point | null>(null);
  const coarse = useCoarsePointer();

  const gap = (TARGET - PAD * 2) / (size - 1);
  const w = PAD * 2 + gap * (size - 1);
  const stars = starPoints(size);
  const dead = deadSet ?? new Set<number>();
  const canPlace = !deadMode && Boolean(previewColor && onPlace);
  const preview = coarse ? selected : hover;
  const nav = useBoardKeyboardNav({
    cols: size,
    rows: size,
    interactive: canPlace,
    canPlace: (x, y) => board[idx(x, y, size)] === null,
    onPlace: (x, y) => onPlace?.(x, y),
  });

  // 착수 가능 여부가 바뀌거나(내 차례가 아니게 됨) 판이 바뀌면(수가 두어짐) 대기 중인 선택을 지운다
  const [prevBoard, setPrevBoard] = useState(board);
  const [prevCanPlace, setPrevCanPlace] = useState(canPlace);
  if (prevBoard !== board || prevCanPlace !== canPlace) {
    setPrevBoard(board);
    setPrevCanPlace(canPlace);
    setSelected(null);
  }

  function px(v: number): number {
    return PAD + v * gap;
  }

  return (
    <>
      <svg
        viewBox={`0 0 ${w} ${w}`}
        className="w-full max-w-[560px] select-none rounded-lg shadow-[0_10px_30px_rgba(26,22,20,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-vermil"
        onMouseLeave={() => setHover(null)}
        onKeyDown={nav.onKeyDown}
        tabIndex={canPlace ? 0 : -1}
        role="img"
        aria-label="바둑판 — 화살표 키로 이동, Enter 또는 Space로 착수"
      >
        <defs>
          <linearGradient id="go-wood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-board-hi)" />
            <stop offset="100%" stopColor="var(--color-board-lo)" />
          </linearGradient>
          <radialGradient id="go-stone-b" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#6b645c" />
            <stop offset="45%" stopColor="#2b2624" />
            <stop offset="100%" stopColor="#0d0b0a" />
          </radialGradient>
          <radialGradient id="go-stone-w" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f0e9da" />
            <stop offset="100%" stopColor="#c9bfa9" />
          </radialGradient>
        </defs>

        {/* 판 배경 */}
        <rect x="0" y="0" width={w} height={w} rx="10" fill="url(#go-wood)" />
        <rect
          x="4" y="4" width={w - 8} height={w - 8} rx="8"
          fill="none" stroke="rgba(122,111,92,0.35)" strokeWidth="1"
        />

        {/* 격자 */}
        {Array.from({ length: size }, (_, i) => (
          <g key={i} stroke="#8a7a5f" strokeWidth={i === 0 || i === size - 1 ? 1.4 : 0.8}>
            <line x1={px(0)} y1={px(i)} x2={px(size - 1)} y2={px(i)} />
            <line x1={px(i)} y1={px(0)} x2={px(i)} y2={px(size - 1)} />
          </g>
        ))}

        {/* 화점 */}
        {stars.map((p) => (
          <circle key={`${p.x}-${p.y}`} cx={px(p.x)} cy={px(p.y)} r="3.2" fill="#6d5f48" />
        ))}

        {/* 놓인 돌 */}
        {board.map((cell, i) => {
          if (!cell) return null;
          const x = i % size;
          const y = Math.floor(i / size);
          const isLast = lastMove && lastMove.x === x && lastMove.y === y;
          const isDead = dead.has(i);
          return (
            <g
              key={`s-${x}-${y}`}
              className="stone-pop"
              opacity={isDead ? 0.4 : 1}
              style={deadMode ? { cursor: "pointer" } : undefined}
              onClick={deadMode ? () => onToggleDead?.(i) : undefined}
            >
              <circle
                cx={px(x)} cy={px(y)} r={gap * 0.44}
                fill={cell === "b" ? "url(#go-stone-b)" : "url(#go-stone-w)"}
                stroke={cell === "b" ? "#000" : "#b3a68d"}
                strokeWidth="0.8"
              />
              {isLast && !isDead && (
                <circle cx={px(x)} cy={px(y)} r="4" fill="var(--color-vermil)" />
              )}
              {isDead && (
                <g stroke="var(--color-vermil)" strokeWidth="2.4" strokeLinecap="round">
                  <line
                    x1={px(x) - gap * 0.22} y1={px(y) - gap * 0.22}
                    x2={px(x) + gap * 0.22} y2={px(y) + gap * 0.22}
                  />
                  <line
                    x1={px(x) + gap * 0.22} y1={px(y) - gap * 0.22}
                    x2={px(x) - gap * 0.22} y2={px(y) + gap * 0.22}
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* 호버(PC) 또는 탭 선택(터치) 미리보기 */}
        {canPlace && preview && board[idx(preview.x, preview.y, size)] === null && (
          <circle
            cx={px(preview.x)} cy={px(preview.y)} r={gap * 0.44}
            fill={previewColor === "b" ? "url(#go-stone-b)" : "url(#go-stone-w)"}
            opacity={coarse ? 0.55 : 0.45}
            stroke={coarse ? "var(--color-vermil)" : "none"}
            strokeWidth={coarse ? 2 : 0}
            strokeDasharray={coarse ? "4 3" : undefined}
            pointerEvents="none"
          />
        )}

        {/* 키보드 커서 */}
        {canPlace && nav.cursor && (
          <rect
            x={px(nav.cursor.x) - gap / 2 + 3} y={px(nav.cursor.y) - gap / 2 + 3}
            width={gap - 6} height={gap - 6}
            rx="4"
            fill="none" stroke="var(--color-vermil)" strokeWidth="2"
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}

        {/* 클릭/호버/탭 히트 영역 (착수) */}
        {canPlace &&
          Array.from({ length: size * size }, (_, i) => {
            const x = i % size;
            const y = Math.floor(i / size);
            if (board[i] !== null) return null;
            return (
              <rect
                key={`h-${x}-${y}`}
                x={px(x) - gap / 2} y={px(y) - gap / 2}
                width={gap} height={gap}
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

      {!coarse && canPlace && (
        <p className="mt-1.5 font-plex text-[10px] text-mud">
          키보드: 방향키 이동 · Enter/Space 착수
        </p>
      )}

      {coarse && canPlace && selected && (
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
