import { describe, expect, it } from "vitest";
import {
  applyDrop,
  boardFromMoves,
  checkWin,
  COLS,
  dropRow,
  emptyBoard,
  idx,
  isDraw,
  nextColor,
  ROWS,
  type GameState,
} from "./logic";

function play(cols: number[]): GameState {
  let state: GameState = { moves: [] };
  for (const x of cols) {
    const r = applyDrop(state, x);
    if (!r) throw new Error(`invalid drop ${x}`);
    state = r.state;
  }
  return state;
}

describe("기본 규칙", () => {
  it("흑이 선공이고 턴이 번갈아 돌아간다", () => {
    expect(nextColor([])).toBe("b");
    const s = play([3]);
    expect(nextColor(s.moves)).toBe("w");
  });

  it("돌은 열의 가장 아래부터 쌓인다", () => {
    const s = play([2, 2, 2]);
    const board = boardFromMoves(s.moves);
    expect(board[idx(2, ROWS - 1)]).toBe("b");
    expect(board[idx(2, ROWS - 2)]).toBe("w");
    expect(board[idx(2, ROWS - 3)]).toBe("b");
  });

  it("가득 찬 열에는 더 이상 둘 수 없다", () => {
    let state: GameState = { moves: [] };
    for (let i = 0; i < ROWS; i++) {
      state = applyDrop(state, 0)!.state;
    }
    expect(dropRow(boardFromMoves(state.moves), 0)).toBeNull();
    expect(applyDrop(state, 0)).toBeNull();
  });

  it("판 밖의 열에는 둘 수 없다", () => {
    expect(applyDrop({ moves: [] }, -1)).toBeNull();
    expect(applyDrop({ moves: [] }, COLS)).toBeNull();
  });
});

describe("4목 판정", () => {
  it("가로 4목 (흑)", () => {
    // 흑: (0..2, 바닥) / 백: 다른 열 쌓기
    const s = play([0, 0, 1, 1, 2, 2]);
    const r = applyDrop(s, 3);
    expect(r?.win?.color).toBe("b");
    expect(r?.win?.line).toHaveLength(4);
  });

  it("세로 4목 (흑)", () => {
    const s = play([0, 1, 0, 1, 0, 1]);
    const r = applyDrop(s, 0);
    expect(r?.win?.color).toBe("b");
    expect(r?.win?.line).toHaveLength(4);
  });

  it("대각선 4목 — 판을 직접 구성해 판정만 검증", () => {
    // 턴 교대 제약과 무관하게 checkWin 자체의 대각선 판정 로직을 검증한다
    const board = emptyBoard();
    board[idx(0, 5)] = "b";
    board[idx(1, 4)] = "b";
    board[idx(2, 3)] = "b";
    board[idx(3, 2)] = "b";
    const win = checkWin(board, 3, 2);
    expect(win?.color).toBe("b");
    expect(win?.line).toHaveLength(4);
    expect(new Set(win!.line.map((p) => `${p.x},${p.y}`))).toEqual(
      new Set(["0,5", "1,4", "2,3", "3,2"]),
    );
  });
});

describe("무승부", () => {
  it("판이 다 차면 무승부가 될 수 있다", () => {
    expect(isDraw(new Array(COLS * ROWS).fill(0).map((_, i) => ({ x: i % COLS, y: 0, c: "b" as const })))).toBe(
      true,
    );
  });
});
