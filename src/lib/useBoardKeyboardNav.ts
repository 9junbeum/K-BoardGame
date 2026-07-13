"use client";

import { type KeyboardEvent, useCallback, useState } from "react";

interface Options {
  cols: number;
  rows: number;
  interactive: boolean;
  /** 이 칸에 착수할 수 있는지 (이미 돌이 있으면 false 등) */
  canPlace: (x: number, y: number) => boolean;
  onPlace: (x: number, y: number) => void;
}

export interface BoardKeyboardNav {
  /** 키보드로 이동 중인 커서 위치. 아직 키보드를 쓰지 않았으면 null */
  cursor: { x: number; y: number } | null;
  onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => void;
}

/**
 * 격자형 보드(오목/바둑/오셀로 등)에 화살표 키 이동 + Enter/Space 착수를 붙이는 훅.
 * 마우스 호버/터치 선택과는 독립적으로 동작해 기존 상호작용을 건드리지 않는다.
 */
export function useBoardKeyboardNav({
  cols,
  rows,
  interactive,
  canPlace,
  onPlace,
}: Options): BoardKeyboardNav {
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const move = useCallback(
    (dx: number, dy: number) => {
      setCursor((prev) => {
        const base = prev ?? { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
        return {
          x: Math.min(cols - 1, Math.max(0, base.x + dx)),
          y: Math.min(rows - 1, Math.max(0, base.y + dy)),
        };
      });
    },
    [cols, rows],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<SVGSVGElement>) => {
      if (!interactive) return;
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
          const c = cursor ?? { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
          if (cursor === null) setCursor(c);
          if (canPlace(c.x, c.y)) onPlace(c.x, c.y);
          break;
        }
        case "Escape":
          setCursor(null);
          break;
        default:
          return;
      }
    },
    [interactive, move, canPlace, onPlace, cols, rows, cursor],
  );

  return { cursor: interactive ? cursor : null, onKeyDown };
}
