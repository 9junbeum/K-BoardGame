import { describe, expect, it } from "vitest";
import {
  applyMove,
  boardFromMoves,
  canPlace,
  checkWin,
  emptyBoard,
  isDraw,
  nextColor,
  SIZE,
  type GameState,
  type Move,
} from "./logic";

function play(coords: [number, number][]): GameState {
  let state: GameState = { moves: [] };
  for (const [x, y] of coords) {
    const r = applyMove(state, x, y);
    if (!r) throw new Error(`invalid move ${x},${y}`);
    state = r.state;
  }
  return state;
}

describe("기본 규칙", () => {
  it("흑이 선공이고 턴이 번갈아 돌아간다", () => {
    expect(nextColor([])).toBe("b");
    const s = play([[7, 7]]);
    expect(nextColor(s.moves)).toBe("w");
  });

  it("이미 돌이 있는 곳에는 둘 수 없다", () => {
    const s = play([[7, 7]]);
    expect(applyMove(s, 7, 7)).toBeNull();
    expect(canPlace(boardFromMoves(s.moves), 7, 7)).toBe(false);
  });

  it("판 밖에는 둘 수 없다", () => {
    const b = emptyBoard();
    expect(canPlace(b, -1, 0)).toBe(false);
    expect(canPlace(b, 0, SIZE)).toBe(false);
    expect(applyMove({ moves: [] }, SIZE, 0)).toBeNull();
  });
});

describe("5목 판정", () => {
  it("가로 5목 (흑)", () => {
    // 흑: (0..4, 0) / 백: (0..3, 5)
    const s = play([
      [0, 0], [0, 5],
      [1, 0], [1, 5],
      [2, 0], [2, 5],
      [3, 0], [3, 5],
    ]);
    const r = applyMove(s, 4, 0);
    expect(r?.win?.color).toBe("b");
    expect(r?.win?.line).toHaveLength(5);
  });

  it("세로 5목 (백)", () => {
    // 흑은 흩어놓고 백이 (7, 3..7) 완성
    const s = play([
      [0, 0], [7, 3],
      [1, 0], [7, 4],
      [2, 0], [7, 5],
      [14, 14], [7, 6],
      [3, 1],
    ]);
    const r = applyMove(s, 7, 7);
    expect(r?.win?.color).toBe("w");
  });

  it("대각선 ↘ 5목", () => {
    const s = play([
      [2, 2], [0, 1],
      [3, 3], [0, 2],
      [4, 4], [0, 3],
      [5, 5], [0, 4],
    ]);
    const r = applyMove(s, 6, 6);
    expect(r?.win?.color).toBe("b");
  });

  it("대각선 ↗ 5목", () => {
    const s = play([
      [2, 10], [0, 1],
      [3, 9], [0, 2],
      [4, 8], [0, 3],
      [5, 7], [0, 4],
    ]);
    const r = applyMove(s, 6, 6);
    expect(r?.win?.color).toBe("b");
  });

  it("중간 채워서 완성해도 판정된다", () => {
    // 흑 _XX_XX_ 에서 가운데를 채움
    const s = play([
      [3, 7], [0, 0],
      [4, 7], [0, 1],
      [6, 7], [0, 2],
      [7, 7], [0, 3],
    ]);
    const r = applyMove(s, 5, 7);
    expect(r?.win?.color).toBe("b");
  });

  it("4목은 승리가 아니다", () => {
    const s = play([
      [0, 0], [0, 5],
      [1, 0], [1, 5],
      [2, 0], [2, 5],
    ]);
    const r = applyMove(s, 3, 0);
    expect(r?.win).toBeNull();
  });

  it("상대 돌로 끊기면 승리가 아니다", () => {
    // 흑 (0..3,0) + 백 (4,0) 후 흑 (5,0)은 4+1로 끊김
    const s = play([
      [0, 0], [4, 0],
      [1, 0], [4, 1],
      [2, 0], [4, 2],
      [3, 0], [4, 3],
    ]);
    const r = applyMove(s, 5, 0);
    expect(r?.win).toBeNull();
  });

  it("6목(장목)도 승리로 인정한다 (프리스타일 규칙)", () => {
    const s = play([
      [0, 0], [0, 5],
      [1, 0], [1, 5],
      [2, 0], [2, 5],
      [4, 0], [3, 5],
      [5, 0], [4, 5],
    ]);
    const r = applyMove(s, 3, 0); // _XXX_XX → 6목
    expect(r?.win?.color).toBe("b");
    expect(r?.win?.line.length).toBeGreaterThanOrEqual(5);
  });
});

describe("무승부", () => {
  it("보드가 가득 차면 무승부", () => {
    const full: Move[] = Array.from({ length: SIZE * SIZE }, (_, i) => ({
      x: i % SIZE,
      y: Math.floor(i / SIZE),
      c: (i % 2 === 0 ? "b" : "w") as Move["c"],
    }));
    expect(isDraw(full)).toBe(true);
    expect(isDraw(full.slice(0, -1))).toBe(false);
  });
});

describe("승리 판정 위치", () => {
  it("checkWin은 마지막 착수 위치 기준으로만 판정한다", () => {
    const s = play([
      [0, 0], [0, 5],
      [1, 0], [1, 5],
      [2, 0], [2, 5],
      [3, 0], [3, 5],
      [4, 0],
    ]);
    const board = boardFromMoves(s.moves);
    expect(checkWin(board, 4, 0)?.color).toBe("b");
    expect(checkWin(board, 0, 5)).toBeNull(); // 백 4목 자리는 승리 아님
  });
});
