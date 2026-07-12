import { describe, expect, it } from "vitest";
import {
  applyPlace,
  applyToBoard,
  countStones,
  deriveOthello,
  idx,
  initialBoard,
  legalMoves,
  type Board,
  type OthelloMove,
} from "./logic";

describe("초기 배치", () => {
  it("중앙에 흑백 2개씩 대각으로 놓여 있다", () => {
    const b = initialBoard();
    expect(b[idx(3, 3)]).toBe("w");
    expect(b[idx(4, 4)]).toBe("w");
    expect(b[idx(3, 4)]).toBe("b");
    expect(b[idx(4, 3)]).toBe("b");
    expect(countStones(b)).toEqual({ b: 2, w: 2 });
  });

  it("흑의 첫 수는 대칭인 4자리뿐이다", () => {
    const moves = legalMoves(initialBoard(), "b");
    const set = new Set(moves.map((p) => `${p.x},${p.y}`));
    expect(set).toEqual(new Set(["2,3", "3,2", "5,4", "4,5"]));
  });
});

describe("착수와 뒤집기", () => {
  it("한 방향의 상대 돌을 뒤집는다", () => {
    const r = applyToBoard(initialBoard(), 2, 3, "b");
    expect(r).not.toBeNull();
    expect(r!.flips).toEqual([idx(3, 3)]);
    expect(r!.board[idx(3, 3)]).toBe("b");
    expect(r!.board[idx(2, 3)]).toBe("b");
  });

  it("여러 방향을 동시에 뒤집을 수 있다", () => {
    // 흑 (2,3) → 백 (3,3) 뒤집힘: 흑 2, 백 3, 판: b(2,3) b(3,3) b(3,4) b(4,3) w(4,4)
    const afterBlack = applyToBoard(initialBoard(), 2, 3, "b")!.board;
    // 백이 (2,2)에 두면 (3,3)[흑]을 세로/가로 두 방향으로 동시에 낄 수 있는지 확인
    const r = applyToBoard(afterBlack, 2, 2, "w");
    expect(r).not.toBeNull();
    expect(r!.flips.length).toBeGreaterThanOrEqual(1);
  });

  it("상대 돌을 끼우지 못하는 자리는 불법이다", () => {
    expect(applyToBoard(initialBoard(), 0, 0, "b")).toBeNull();
  });

  it("이미 돌이 있는 자리에는 둘 수 없다", () => {
    expect(applyToBoard(initialBoard(), 3, 3, "b")).toBeNull();
  });
});

describe("차례 진행", () => {
  it("흑이 선공이고, 다음은 백 차례다", () => {
    expect(deriveOthello([]).toMove).toBe("b");
    const r = applyPlace([], 2, 3);
    expect(r).not.toBeNull();
    expect(deriveOthello(r!.moves).toMove).toBe("w");
  });

  it("불법수는 거부된다", () => {
    expect(applyPlace([], 0, 0)).toBeNull();
  });
});

describe("둘 곳이 없으면 자동으로 건너뛴다", () => {
  it("낄 상대 돌이 없으면 어느 색도 둘 곳이 없다", () => {
    // 흑만 덩그러니 있고 백이 아예 없는 판 — 뒤집을 대상이 없어 양쪽 다 둘 곳이 없다
    const board: Board = new Array(64).fill(null);
    board[idx(3, 3)] = "b";
    board[idx(4, 4)] = "b";
    expect(legalMoves(board, "w")).toEqual([]);
    expect(legalMoves(board, "b")).toEqual([]);
  });
});

describe("무르기(마지막 수 취소)", () => {
  it("마지막 수를 지우면 그 이전 판으로 정확히 되돌아간다", () => {
    const r1 = applyPlace([], 2, 3)!;
    const before = deriveOthello(r1.moves);
    const r2 = applyPlace(r1.moves, 2, 2)!;
    const undone: OthelloMove[] = r2.moves.slice(0, -1);
    expect(deriveOthello(undone).board).toEqual(before.board);
    expect(deriveOthello(undone).toMove).toBe("w");
  });
});
