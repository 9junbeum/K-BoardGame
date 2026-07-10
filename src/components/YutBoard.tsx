"use client";

import { useEffect, useRef, useState } from "react";
import { NODE_COORDS, type YutPiece } from "@/games/yut/logic";

export const PLAYER_COLORS = ["#8b2a1f", "#1a1614", "#2b4a6f", "#5a6f2b"];
const PLAYER_COLORS_LIGHT = ["#c96a5c", "#5c534d", "#6d8fbd", "#96ad64"];

const PAD = 44;
const CELL = 94;
const W = PAD * 2 + CELL * 5; // 558

function px(v: number): number {
  return PAD + v * CELL;
}

const BIG_NODES = new Set([0, 5, 10, 15, 22]);
const STEP_MS = 160;

/**
 * 말 하나 — trail이 길어지면 경로를 따라 칸칸이 이동하는 애니메이션.
 * 대기(ready) 말은 출발점에 투명하게 두어 투입 모션이 자연스럽게 이어진다.
 */
function AnimatedPiece({
  trail,
  visible,
  colorIdx,
  dx,
  dy,
}: {
  trail: number[];
  visible: boolean;
  colorIdx: number;
  dx: number;
  dy: number;
}) {
  const [pos, setPos] = useState<number>(trail[trail.length - 1] ?? 0);
  const prevTrailRef = useRef<number[]>(trail);

  useEffect(() => {
    const prev = prevTrailRef.current;
    prevTrailRef.current = trail;
    const target = trail[trail.length - 1] ?? 0;
    const start = prev[prev.length - 1] ?? 0;
    if (start === target && prev.length === trail.length) return;

    // 앞으로 이동: 새 trail에서 start 이후 구간을 순서대로 밟는다
    let path: number[];
    const i = trail.length > prev.length ? trail.lastIndexOf(start) : -1;
    if (i >= 0 && i < trail.length - 1) {
      path = trail.slice(i + 1);
    } else {
      path = [target]; // 빽도/잡힘 등은 한 번에
    }

    let step = 0;
    const id = setInterval(() => {
      setPos(path[step]);
      step++;
      if (step >= path.length) clearInterval(id);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [trail]);

  const c = NODE_COORDS[pos] ?? NODE_COORDS[0];
  const cx = px(c.x) + dx;
  const cy = px(c.y) + dy;

  return (
    <g
      className="yut-piece"
      pointerEvents="none"
      style={{ transform: `translate(${cx}px, ${cy}px)`, opacity: visible ? 1 : 0 }}
    >
      {/* 그림자 */}
      <ellipse cx="0" cy="10" rx="10" ry="3.6" fill="rgba(26,22,20,0.3)" />
      {/* 몸통 */}
      <circle cx="0" cy="1" r="10.5" fill={`url(#piece-g-${colorIdx})`} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
      {/* 머리 */}
      <circle cx="0" cy="-8.5" r="6" fill={`url(#piece-g-${colorIdx})`} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
      {/* 하이라이트 */}
      <ellipse cx="-2.5" cy="-10.5" rx="2.2" ry="1.6" fill="rgba(255,255,255,0.55)" />
      <ellipse cx="-3" cy="-2.5" rx="3" ry="2.2" fill="rgba(255,255,255,0.35)" />
    </g>
  );
}

interface YutBoardProps {
  pieces: Record<string, YutPiece[]>;
  /** 턴 순서 = 색 배정 순서 */
  order: string[];
  /** 클릭 가능한 노드 */
  selectableNodes?: Set<number>;
  onNodeClick?: (node: number) => void;
}

export default function YutBoard({ pieces, order, selectableNodes, onNodeClick }: YutBoardProps) {
  const edges: [number, number][] = [];
  for (let i = 0; i < 19; i++) edges.push([i, i + 1]);
  edges.push([19, 0]);

  return (
    <svg
      viewBox={`0 0 ${W} ${W}`}
      className="w-full max-w-[558px] select-none rounded-lg shadow-[0_10px_30px_rgba(26,22,20,0.25)]"
      role="img"
      aria-label="윷놀이판"
    >
      <defs>
        <linearGradient id="yut-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-board-hi)" />
          <stop offset="100%" stopColor="var(--color-board-lo)" />
        </linearGradient>
        {PLAYER_COLORS.map((c, i) => (
          <radialGradient key={i} id={`piece-g-${i}`} cx="0.35" cy="0.3" r="1">
            <stop offset="0%" stopColor={PLAYER_COLORS_LIGHT[i]} />
            <stop offset="55%" stopColor={c} />
            <stop offset="100%" stopColor="#100d0b" />
          </radialGradient>
        ))}
      </defs>

      <rect x="0" y="0" width={W} height={W} rx="10" fill="url(#yut-wood)" />
      <rect
        x="4" y="4" width={W - 8} height={W - 8} rx="8"
        fill="none" stroke="rgba(122,111,92,0.35)" strokeWidth="1"
      />

      {/* 연결선 */}
      {edges.map(([a, b]) => (
        <line
          key={`e-${a}-${b}`}
          x1={px(NODE_COORDS[a].x)} y1={px(NODE_COORDS[a].y)}
          x2={px(NODE_COORDS[b].x)} y2={px(NODE_COORDS[b].y)}
          stroke="#8a7a5f" strokeWidth="2"
        />
      ))}
      <line x1={px(5)} y1={px(0)} x2={px(0)} y2={px(5)} stroke="#8a7a5f" strokeWidth="2" />
      <line x1={px(0)} y1={px(0)} x2={px(5)} y2={px(5)} stroke="#8a7a5f" strokeWidth="2" />

      {/* 노드 */}
      {Object.entries(NODE_COORDS).map(([k, c]) => {
        const node = Number(k);
        const big = BIG_NODES.has(node);
        const selectable = selectableNodes?.has(node) ?? false;
        return (
          <g
            key={`n-${node}`}
            onClick={selectable ? () => onNodeClick?.(node) : undefined}
            className={selectable ? "cursor-pointer" : undefined}
          >
            <circle
              cx={px(c.x)} cy={px(c.y)} r={big ? 20 : 13}
              fill="var(--color-paper)"
              stroke={big ? "#6d5f48" : "#8a7a5f"}
              strokeWidth={big ? 2.4 : 1.6}
            />
            {big && (
              <circle
                cx={px(c.x)} cy={px(c.y)} r={12}
                fill="none" stroke="#8a7a5f" strokeWidth="1.2"
              />
            )}
            {selectable && (
              <circle
                cx={px(c.x)} cy={px(c.y)} r={big ? 27 : 21}
                fill="none" stroke="var(--color-vermil)" strokeWidth="2.5"
                strokeDasharray="5 4"
              />
            )}
          </g>
        );
      })}

      <text
        x={px(5)} y={px(5) + 40}
        textAnchor="middle" fontSize="12" fill="#6d5f48"
        fontFamily="var(--font-plex)"
      >
        출발·도착
      </text>

      {/* 말 (플레이어/말 인덱스로 identity 고정 → 이동 애니메이션) */}
      {order.map((pid, playerIdx) =>
        (pieces[pid] ?? []).map((p, pieceIdx) => {
          const onBoard = typeof p.pos === "number";
          const trail = onBoard && p.trail.length > 0 ? p.trail : [0];
          return (
            <AnimatedPiece
              key={`pc-${pid}-${pieceIdx}`}
              trail={trail}
              visible={onBoard}
              colorIdx={playerIdx}
              dx={(pieceIdx - 1.5) * 5}
              dy={pieceIdx * -2}
            />
          );
        }),
      )}
    </svg>
  );
}
