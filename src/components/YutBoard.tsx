"use client";

import { NODE_COORDS, type YutPiece } from "@/games/yut/logic";

export const PLAYER_COLORS = ["#8b2a1f", "#1a1614", "#2b4a6f", "#5a6f2b"];

const PAD = 44;
const CELL = 94;
const W = PAD * 2 + CELL * 5; // 558

function px(v: number): number {
  return PAD + v * CELL;
}

const BIG_NODES = new Set([0, 5, 10, 15, 22]);

interface YutBoardProps {
  pieces: Record<string, YutPiece[]>;
  /** 턴 순서 = 색 배정 순서 */
  order: string[];
  /** 클릭 가능한 노드 (선택된 결과를 적용할 내 말이 있는 곳) */
  selectableNodes?: Set<number>;
  onNodeClick?: (node: number) => void;
}

export default function YutBoard({ pieces, order, selectableNodes, onNodeClick }: YutBoardProps) {
  // 노드별 점유 현황: node → { playerIdx, count }[]
  const occupancy = new Map<number, { idx: number; count: number }[]>();
  order.forEach((pid, idx) => {
    for (const p of pieces[pid] ?? []) {
      if (typeof p.pos !== "number") continue;
      const list = occupancy.get(p.pos) ?? [];
      const entry = list.find((e) => e.idx === idx);
      if (entry) entry.count += 1;
      else list.push({ idx, count: 1 });
      occupancy.set(p.pos, list);
    }
  });

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
      </defs>

      <rect x="0" y="0" width={W} height={W} rx="10" fill="url(#yut-wood)" />
      <rect
        x="4" y="4" width={W - 8} height={W - 8} rx="8"
        fill="none" stroke="rgba(122,111,92,0.35)" strokeWidth="1"
      />

      {/* 연결선: 둘레 */}
      {edges.map(([a, b]) => (
        <line
          key={`e-${a}-${b}`}
          x1={px(NODE_COORDS[a].x)} y1={px(NODE_COORDS[a].y)}
          x2={px(NODE_COORDS[b].x)} y2={px(NODE_COORDS[b].y)}
          stroke="#8a7a5f" strokeWidth="2"
        />
      ))}
      {/* 대각선 */}
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
                cx={px(c.x)} cy={px(c.y)} r={big ? 12 : 8}
                fill="none" stroke="#8a7a5f" strokeWidth="1.2"
              />
            )}
            {selectable && (
              <circle
                cx={px(c.x)} cy={px(c.y)} r={big ? 26 : 20}
                fill="none" stroke="var(--color-vermil)" strokeWidth="2.5"
                strokeDasharray="5 4"
              />
            )}
          </g>
        );
      })}

      {/* 출발 표시 */}
      <text
        x={px(5)} y={px(5) + 38}
        textAnchor="middle"
        fontSize="12"
        fill="#6d5f48"
        fontFamily="var(--font-plex)"
      >
        출발·도착
      </text>

      {/* 말 */}
      {Array.from(occupancy.entries()).map(([node, list]) => {
        const c = NODE_COORDS[node];
        return list.map((e, li) => {
          const off = (li - (list.length - 1) / 2) * 16;
          return (
            <g key={`p-${node}-${e.idx}`} className="stone-pop" pointerEvents="none">
              <circle
                cx={px(c.x) + off} cy={px(c.y)} r={12}
                fill={PLAYER_COLORS[e.idx]}
                stroke="var(--color-paper)"
                strokeWidth="2"
              />
              {e.count > 1 && (
                <text
                  x={px(c.x) + off} y={px(c.y) + 4.5}
                  textAnchor="middle" fontSize="13" fontWeight="bold"
                  fill="var(--color-paper)"
                >
                  {e.count}
                </text>
              )}
            </g>
          );
        });
      })}
    </svg>
  );
}
