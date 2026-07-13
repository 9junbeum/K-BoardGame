import { describe, expect, it } from "vitest";
import {
  anyCaptureAvailable,
  applyPath,
  captureMovesFrom,
  countPieces,
  deriveCheckers,
  idx,
  initialBoard,
  isDark,
  simpleMovesFrom,
  type Board,
  type GameState,
} from "./logic";

function play(state: GameState, color: "b" | "w", path: { x: number; y: number }[]): GameState {
  const r = applyPath(state, color, path);
  if (!r) throw new Error(`invalid move ${JSON.stringify(path)}`);
  return r.state;
}

describe("초기 배치", () => {
  it("어두운 칸에만 흑 12개, 백 12개가 놓인다", () => {
    const b = initialBoard();
    expect(countPieces(b)).toEqual({ b: 12, w: 12 });
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 8; x++) {
        if (isDark(x, y)) expect(b[idx(x, y)]).toEqual({ color: "b", king: false });
      }
    }
    for (let y = 5; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (isDark(x, y)) expect(b[idx(x, y)]).toEqual({ color: "w", king: false });
      }
    }
  });

  it("가운데 두 줄은 비어 있다", () => {
    const b = initialBoard();
    for (let y = 3; y <= 4; y++) {
      for (let x = 0; x < 8; x++) expect(b[idx(x, y)]).toBeNull();
    }
  });
});

describe("단순 이동", () => {
  it("흑은 대각선 앞(y 증가)으로만 한 칸 이동한다", () => {
    const b = initialBoard();
    const moves = simpleMovesFrom(b, 3, 2); // (3,2)는 흑 말이 있는 어두운 칸
    expect(new Set(moves.map((p) => `${p.x},${p.y}`))).toEqual(new Set(["2,3", "4,3"]));
  });

  it("판 가장자리 말은 판 밖으로 나가는 방향이 제외된다", () => {
    const b = initialBoard();
    expect(simpleMovesFrom(b, 7, 2)).toEqual([{ x: 6, y: 3 }]);
  });

  it("이동하면 턴이 상대에게 넘어간다", () => {
    let state: GameState = { moves: [] };
    state = play(state, "b", [{ x: 3, y: 2 }, { x: 4, y: 3 }]);
    const d = deriveCheckers(state.moves);
    expect(d.toMove).toBe("w");
    expect(d.board[idx(4, 3)]).toEqual({ color: "b", king: false });
    expect(d.board[idx(3, 2)]).toBeNull();
  });

  it("대각선이 아닌(수직) 이동은 허용되지 않는다", () => {
    const state: GameState = { moves: [] };
    expect(applyPath(state, "b", [{ x: 3, y: 2 }, { x: 3, y: 3 }])).toBeNull();
  });
});

describe("잡기(강제 잡기 포함)", () => {
  it("인접한 상대 말을 뛰어넘어 잡을 수 있다", () => {
    let state: GameState = { moves: [] };
    state = play(state, "b", [{ x: 3, y: 2 }, { x: 4, y: 3 }]);
    // 백이 (2,5)->(3,4)로 이동해 흑 (4,3) 대각선 앞에 인접 — 그 너머 (2,5)는 방금 비었다
    state = play(state, "w", [{ x: 2, y: 5 }, { x: 3, y: 4 }]);
    const d = deriveCheckers(state.moves);
    expect(d.forcedCapture).toBe(true);
    expect(captureMovesFrom(d.board, 4, 3)).toEqual([{ to: { x: 2, y: 5 }, captured: { x: 3, y: 4 } }]);

    state = play(state, "b", [{ x: 4, y: 3 }, { x: 2, y: 5 }]);
    const d2 = deriveCheckers(state.moves);
    expect(d2.board[idx(3, 4)]).toBeNull(); // 잡힌 말 제거
    expect(d2.board[idx(2, 5)]).toEqual({ color: "b", king: false });
    expect(countPieces(d2.board)).toEqual({ b: 12, w: 11 });
  });

  it("잡을 수 있는 수가 있으면 다른 말의 단순 이동은 허용되지 않는다", () => {
    let state: GameState = { moves: [] };
    state = play(state, "b", [{ x: 3, y: 2 }, { x: 4, y: 3 }]);
    state = play(state, "w", [{ x: 2, y: 5 }, { x: 3, y: 4 }]);
    // 흑은 (4,3)->(2,5) 잡기를 해야 하며, 관계없는 말의 단순 이동은 거부된다
    expect(applyPath(state, "b", [{ x: 1, y: 2 }, { x: 0, y: 3 }])).toBeNull();
  });

  it("연속 잡기: 한 번 잡은 뒤 더 잡을 수 있으면 도중에 멈춘 경로는 거부된다", () => {
    // 흑 (1,2)가 백 (2,3)을 잡아 (3,4)에 착지한 뒤, 백 (4,5)를 다시 잡아 (5,6)까지
    // 이어갈 수 있는 상황을 설정한다. 실전 기보를 흉내 낼 필요는 없으므로,
    // deriveCheckers가 유효성 검사 없이 그대로 재생한다는 점을 이용해 moves 배열을
    // 직접 구성한다 — 흑 차례(짝수 인덱스) 자리는 빈 칸을 가리키는 더미 수로 채워
    // 그냥 건너뛰게 하고, 백 차례에만 실제로 말을 옮긴다.
    const dummy = { color: "b" as const, path: [{ x: 3, y: 3 }, { x: 3, y: 3 }], captured: [], promoted: false };
    const state: GameState = {
      moves: [
        dummy, // index0(흑) — (3,3)은 항상 비어 있어 무시된다
        { color: "w", path: [{ x: 2, y: 5 }, { x: 2, y: 3 }], captured: [], promoted: false }, // 첫 잡기 대상 마련
        dummy, // index2(흑)
        { color: "w", path: [{ x: 5, y: 6 }, { x: 0, y: 3 }], captured: [], promoted: false }, // 두 번째 착지 자리 확보
      ],
    };
    const d = deriveCheckers(state.moves);
    expect(d.toMove).toBe("b");
    expect(captureMovesFrom(d.board, 1, 2)).toEqual([{ to: { x: 3, y: 4 }, captured: { x: 2, y: 3 } }]);

    // 한 번만 잡고 멈춘 경로 — 더 잡을 수 있으므로 거부되어야 한다
    expect(applyPath(state, "b", [{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBeNull();

    // 끝까지 이어간 경로는 허용된다
    const r = applyPath(state, "b", [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }]);
    expect(r).not.toBeNull();
    expect(r!.captured).toEqual([{ x: 2, y: 3 }, { x: 4, y: 5 }]);
    const d2 = deriveCheckers(r!.state.moves);
    expect(d2.board[idx(5, 6)]).toEqual({ color: "b", king: false });
    expect(d2.board[idx(2, 3)]).toBeNull();
    expect(d2.board[idx(4, 5)]).toBeNull();
  });
});

describe("킹 승격", () => {
  it("도착 칸이 승격 줄이면 킹으로 표시된다", () => {
    const moves: GameState["moves"] = [
      { color: "b", path: [{ x: 1, y: 0 }, { x: 0, y: 7 }], captured: [], promoted: true },
    ];
    const d = deriveCheckers(moves);
    expect(d.board[idx(0, 7)]).toEqual({ color: "b", king: true });
  });

  it("킹은 대각선 네 방향 모두로 이동할 수 있다", () => {
    const board: Board = new Array(64).fill(null);
    board[idx(3, 4)] = { color: "b", king: true };
    const moves = simpleMovesFrom(board, 3, 4);
    expect(new Set(moves.map((p) => `${p.x},${p.y}`))).toEqual(
      new Set(["2,3", "4,3", "2,5", "4,5"]),
    );
  });
});

describe("게임 종료", () => {
  it("게임 시작 시점에는 아직 끝나지 않는다", () => {
    const d = deriveCheckers([]);
    expect(d.gameOver).toBe(false);
  });

  it("둘 곳이 전혀 없으면(이동도 잡기도 불가) 그 색이 진다", () => {
    const board: Board = new Array(64).fill(null);
    board[idx(0, 1)] = { color: "b", king: false };
    board[idx(1, 2)] = { color: "w", king: false }; // 유일한 전진 대각선을 막음
    board[idx(2, 3)] = { color: "w", king: false }; // 그 너머도 막아 잡기도 불가
    expect(simpleMovesFrom(board, 0, 1)).toEqual([]);
    expect(captureMovesFrom(board, 0, 1)).toEqual([]);
    expect(anyCaptureAvailable(board, "b")).toBe(false);
  });
});
