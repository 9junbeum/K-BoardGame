"use client";

import { type KeyboardEvent, useState } from "react";
import {
  captureMovesFrom,
  idx,
  isDark,
  SIZE,
  simpleMovesFrom,
  type Board as BoardT,
  type Point,
} from "@/games/checkers/logic";

const PAD = 8;
const CELL = 64;
const W = PAD * 2 + CELL * SIZE;

function center(v: number): number {
  return PAD + v * CELL + CELL / 2;
}

interface ChainState {
  path: Point[];
  captured: Point[];
}

interface CheckersBoardProps {
  board: BoardT;
  /** 지금 착수 가능한 말들의 시작 칸 (강제 잡기 규칙이 이미 반영된 목록) */
  legalStarts: Point[];
  interactive: boolean;
  /** 완성된 한 수(단순 이동 또는 연속 잡기 경로 전체)를 부모에 전달 */
  onMove: (path: Point[]) => void;
}

export default function CheckersBoard({ board, legalStarts, interactive, onMove }: CheckersBoardProps) {
  const [chain, setChain] = useState<ChainState | null>(null);

  // 내 차례가 아니게 되거나 판이 바뀌면(수가 두어짐) 진행 중인 선택을 지운다
  const [prevBoard, setPrevBoard] = useState(board);
  const [prevInteractive, setPrevInteractive] = useState(interactive);
  if (prevBoard !== board || prevInteractive !== interactive) {
    setPrevBoard(board);
    setPrevInteractive(interactive);
    setChain(null);
  }

  const legalStartSet = new Set(legalStarts.map((p) => idx(p.x, p.y)));

  // 연속 잡기 도중에는 화면에도 이미 잡은 말/이동한 말을 반영해서 보여준다
  const displayBoard = (() => {
    if (!chain) return board;
    const b = board.slice();
    const start = chain.path[0];
    const piece = b[idx(start.x, start.y)];
    b[idx(start.x, start.y)] = null;
    for (const c of chain.captured) b[idx(c.x, c.y)] = null;
    const end = chain.path[chain.path.length - 1];
    if (piece) b[idx(end.x, end.y)] = { color: piece.color, king: piece.king };
    return b;
  })();

  const current = chain ? chain.path[chain.path.length - 1] : null;
  const capturing = Boolean(chain && chain.captured.length > 0);
  const captureOptions = current ? captureMovesFrom(displayBoard, current.x, current.y) : [];
  const destinations: Point[] = !current
    ? []
    : capturing || captureOptions.length > 0
      ? captureOptions.map((o) => o.to)
      : simpleMovesFrom(displayBoard, current.x, current.y);
  const destSet = new Set(destinations.map((p) => idx(p.x, p.y)));

  function selectOrMove(x: number, y: number) {
    if (!interactive) return;

    if (current && destSet.has(idx(x, y))) {
      const capOpt = captureOptions.find((o) => o.to.x === x && o.to.y === y);
      const newPath = [...chain!.path, { x, y }];
      if (capOpt) {
        const newCaptured = [...chain!.captured, capOpt.captured];
        // 이 잡기 이후에도 같은 말로 더 잡을 수 있으면 연속 잡기를 이어간다
        const b = board.slice();
        const start = newPath[0];
        const piece = b[idx(start.x, start.y)];
        b[idx(start.x, start.y)] = null;
        for (const c of newCaptured) b[idx(c.x, c.y)] = null;
        if (piece) b[idx(x, y)] = { color: piece.color, king: piece.king };
        if (captureMovesFrom(b, x, y).length > 0) {
          setChain({ path: newPath, captured: newCaptured });
          return;
        }
      }
      onMove(newPath);
      setChain(null);
      return;
    }

    if (legalStartSet.has(idx(x, y)) && (!chain || chain.captured.length === 0)) {
      setChain({ path: [{ x, y }], captured: [] });
      return;
    }

    if (chain && chain.captured.length === 0) {
      setChain(null);
    }
  }

  const [cursor, setCursor] = useState<Point | null>(null);
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const move = (dx: number, dy: number) => {
      setCursor((prev) => {
        const base = prev ?? current ?? { x: Math.floor(SIZE / 2), y: Math.floor(SIZE / 2) };
        return {
          x: Math.min(SIZE - 1, Math.max(0, base.x + dx)),
          y: Math.min(SIZE - 1, Math.max(0, base.y + dy)),
        };
      });
    };
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        move(-1, 0);
        break;
      case "ArrowRight":
        e.preventDefault();
        move(1, 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(0, -1);
        break;
      case "ArrowDown":
        e.preventDefault();
        move(0, 1);
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        const c = cursor ?? current ?? { x: Math.floor(SIZE / 2), y: Math.floor(SIZE / 2) };
        setCursor(c);
        selectOrMove(c.x, c.y);
        break;
      }
      case "Escape":
        setChain(null);
        setCursor(null);
        break;
    }
  };

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${W}`}
        className="w-full max-w-[520px] select-none rounded-lg shadow-[0_10px_30px_rgba(26,22,20,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-vermil"
        onKeyDown={onKeyDown}
        tabIndex={interactive ? 0 : -1}
        role="img"
        aria-label="체커판 — 화살표 키로 이동, Enter 또는 Space로 선택·착수"
      >
        <defs>
          <radialGradient id="ck-b" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#6b645c" />
            <stop offset="45%" stopColor="#2b2624" />
            <stop offset="100%" stopColor="#0d0b0a" />
          </radialGradient>
          <radialGradient id="ck-w" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f0e9da" />
            <stop offset="100%" stopColor="#c9bfa9" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={W} height={W} rx="10" fill="var(--color-board-hi)" />

        {/* 칸 */}
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const dark = isDark(x, y);
          return (
            <rect
              key={`sq-${x}-${y}`}
              x={PAD + x * CELL} y={PAD + y * CELL}
              width={CELL} height={CELL}
              fill={dark ? "#7a6a52" : "var(--color-board-lo)"}
            />
          );
        })}

        {/* 시작 가능 칸 표시 */}
        {interactive && !chain &&
          legalStarts.map((p) => (
            <rect
              key={`ls-${p.x}-${p.y}`}
              x={PAD + p.x * CELL + 4} y={PAD + p.y * CELL + 4}
              width={CELL - 8} height={CELL - 8}
              rx="6"
              fill="none" stroke="var(--color-vermil)" strokeWidth="2" strokeDasharray="5 4"
              opacity="0.6"
              pointerEvents="none"
            />
          ))}

        {/* 말 */}
        {displayBoard.map((cell, i) => {
          if (!cell) return null;
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const isSelected = current && current.x === x && current.y === y;
          return (
            <g key={`p-${x}-${y}`} className="stone-pop">
              <circle
                cx={center(x)} cy={center(y)} r={CELL * 0.38}
                fill={cell.color === "b" ? "url(#ck-b)" : "url(#ck-w)"}
                stroke={isSelected ? "var(--color-vermil)" : cell.color === "b" ? "#000" : "#b3a68d"}
                strokeWidth={isSelected ? 3 : 0.8}
              />
              {cell.king && (
                <circle
                  cx={center(x)} cy={center(y)} r={CELL * 0.16}
                  fill="none"
                  stroke={cell.color === "b" ? "#c9a24a" : "#8b6b1f"}
                  strokeWidth="2.5"
                />
              )}
            </g>
          );
        })}

        {/* 이동 가능 칸 표시 */}
        {destinations.map((p) => (
          <circle
            key={`d-${p.x}-${p.y}`}
            cx={center(p.x)} cy={center(p.y)} r={CELL * 0.16}
            fill="var(--color-vermil)" opacity="0.55"
            pointerEvents="none"
          />
        ))}

        {/* 키보드 커서 */}
        {interactive && cursor && (
          <rect
            x={PAD + cursor.x * CELL + 2} y={PAD + cursor.y * CELL + 2}
            width={CELL - 4} height={CELL - 4}
            rx="6"
            fill="none" stroke="var(--color-vermil)" strokeWidth="2" strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}

        {/* 클릭 히트 영역 */}
        {interactive &&
          Array.from({ length: SIZE * SIZE }, (_, i) => {
            const x = i % SIZE;
            const y = Math.floor(i / SIZE);
            if (!isDark(x, y)) return null;
            return (
              <rect
                key={`h-${x}-${y}`}
                x={PAD + x * CELL} y={PAD + y * CELL}
                width={CELL} height={CELL}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => selectOrMove(x, y)}
              />
            );
          })}
      </svg>

      {interactive && (
        <p className="mt-1.5 font-plex text-[10px] text-mud">
          말을 클릭해 선택한 뒤 이동할 칸을 클릭하세요 · 키보드: 방향키 이동 · Enter/Space 선택·착수
        </p>
      )}
    </>
  );
}
