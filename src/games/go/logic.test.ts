import { describe, expect, it } from "vitest";
import {
  applyPass,
  applyPlace,
  computeScore,
  deriveGo,
  emptyBoard,
  idx,
  isDoublePass,
  toggleDeadGroup,
  type Board,
  type GoAction,
} from "./logic";

const SIZE = 9;

function play(moves: GoAction[], coords: [number, number][]): GoAction[] {
  let m = moves;
  for (const [x, y] of coords) {
    const r = applyPlace(m, SIZE, x, y);
    if (!r) throw new Error(`invalid move ${x},${y}`);
    m = r.moves;
  }
  return m;
}

describe("기본 규칙", () => {
  it("흑이 선공이고 턴이 번갈아 돌아간다", () => {
    expect(deriveGo([], SIZE).toMove).toBe("b");
    const moves = play([], [[4, 4]]);
    expect(deriveGo(moves, SIZE).toMove).toBe("w");
  });

  it("이미 돌이 있는 곳에는 둘 수 없다", () => {
    const moves = play([], [[4, 4]]);
    expect(applyPlace(moves, SIZE, 4, 4)).toBeNull();
  });

  it("판 밖에는 둘 수 없다", () => {
    expect(applyPlace([], SIZE, -1, 0)).toBeNull();
    expect(applyPlace([], SIZE, 0, SIZE)).toBeNull();
  });
});

describe("따내기(capture)", () => {
  it("사방이 막히면 돌을 딴다", () => {
    // 백 (1,1)을 흑이 사방으로 포위
    const moves = play([], [
      [0, 1], [1, 1], // b, w(피포위 돌)
      [1, 0], [8, 8], // b, w(더미)
      [2, 1], [8, 7], // b, w(더미)
    ]);
    const before = deriveGo(moves, SIZE);
    expect(before.board[idx(1, 1, SIZE)]).toBe("w");

    const r = applyPlace(moves, SIZE, 1, 2); // 마지막 자유 메움
    expect(r).not.toBeNull();
    const after = deriveGo(r!.moves, SIZE);
    expect(after.board[idx(1, 1, SIZE)]).toBeNull();
    expect(after.captures.b).toBe(1);
  });
});

describe("자충수(suicide) 금지", () => {
  it("아무것도 못 잡으면서 자기 돌의 자유가 0이 되는 수는 둘 수 없다", () => {
    // 흑이 (1,1)을 완전히 둘러싼 뒤, 백이 그 안에 들어가려 하면 불법
    const moves = play([], [
      [0, 1], [8, 8],
      [1, 0], [8, 7],
      [2, 1], [8, 6],
      [1, 2],
    ]);
    // 지금은 백 차례
    expect(deriveGo(moves, SIZE).toMove).toBe("w");
    expect(applyPlace(moves, SIZE, 1, 1)).toBeNull();
  });
});

describe("패(ko) 규칙", () => {
  it("돌 1개를 딴 자리는 상대가 곧바로 되따낼 수 없고, 한 수 쉬면 다시 가능하다", () => {
    // 표준 패 모양
    //   .  X  O  .
    //   X  O  .  O
    //   .  X  O  .
    let moves = play([], [
      [8, 8], // b 더미 (수 균형용)
      [2, 0], // w
      [1, 0], // b
      [1, 1], // w
      [0, 1], // b
      [3, 1], // w
      [1, 2], // b
      [2, 2], // w
    ]);
    // 흑이 (2,1)에 두어 백 1개(1,1)를 따낸다
    const capture = applyPlace(moves, SIZE, 2, 1);
    expect(capture).not.toBeNull();
    moves = capture!.moves;
    const derived = deriveGo(moves, SIZE);
    expect(derived.board[idx(1, 1, SIZE)]).toBeNull();
    expect(derived.koPoint).toBe(idx(1, 1, SIZE));

    // 백이 곧바로 되따내는 것은 금지
    expect(applyPlace(moves, SIZE, 1, 1)).toBeNull();

    // 백이 다른 곳에 두면(한 수 쉬면)
    const elsewhere = applyPlace(moves, SIZE, 8, 7);
    expect(elsewhere).not.toBeNull();
    moves = elsewhere!.moves;
    // 흑도 다른 곳에 둔다
    const blackElsewhere = applyPlace(moves, SIZE, 8, 6);
    expect(blackElsewhere).not.toBeNull();
    moves = blackElsewhere!.moves;

    // 이제 백이 (1,1)에 다시 두는 것은 합법 (패가 풀림)
    expect(applyPlace(moves, SIZE, 1, 1)).not.toBeNull();
  });
});

describe("패스와 대국 종료", () => {
  it("연속 2패스면 isDoublePass가 true", () => {
    let moves = play([], [[4, 4]]);
    expect(isDoublePass(moves)).toBe(false);
    moves = applyPass(moves).moves;
    expect(isDoublePass(moves)).toBe(false);
    moves = applyPass(moves).moves;
    expect(isDoublePass(moves)).toBe(true);
  });

  it("패스도 턴을 소모한다", () => {
    const moves = applyPass([]).moves;
    expect(deriveGo(moves, SIZE).toMove).toBe("w");
  });
});

describe("죽은 돌 표시 토글", () => {
  it("클릭한 돌이 속한 그룹 전체가 함께 토글된다", () => {
    const moves = play([], [
      [1, 1], [8, 8], // b
      [2, 1], [8, 7], // b (연결된 흑 그룹)
    ]);
    const board = deriveGo(moves, SIZE).board;
    let dead = toggleDeadGroup(board, SIZE, [], idx(1, 1, SIZE));
    expect(dead.sort()).toEqual([idx(1, 1, SIZE), idx(2, 1, SIZE)].sort());
    dead = toggleDeadGroup(board, SIZE, dead, idx(2, 1, SIZE));
    expect(dead).toEqual([]);
  });
});

describe("계가(지역계수)", () => {
  it("집 + 사로잡은 돌로 점수를 계산하고, 덤을 더한다", () => {
    const size = 5;
    const board: Board = emptyBoard(size);
    for (let y = 0; y < size; y++) {
      board[idx(1, y, size)] = "b";
      board[idx(3, y, size)] = "w";
    }
    const score = computeScore(board, size, [], { b: 2, w: 1 }, 6.5);
    expect(score.territory).toEqual({ b: 5, w: 5 });
    expect(score.total.b).toBe(7); // 5 + 2
    expect(score.total.w).toBe(12.5); // 5 + 1 + 6.5
    expect(score.winner).toBe("w");
  });

  it("죽은 돌로 합의되면 상대 포로가 되고 그 자리도 집이 된다", () => {
    const size = 3;
    const board: Board = emptyBoard(size);
    board[idx(1, 0, size)] = "b";
    board[idx(0, 1, size)] = "b";
    board[idx(2, 1, size)] = "b";
    board[idx(1, 2, size)] = "b";
    board[idx(1, 1, size)] = "w"; // 완전히 둘러싸인 사석
    const score = computeScore(board, size, [idx(1, 1, size)], { b: 0, w: 0 }, 0);
    expect(score.deadRemoved).toEqual({ b: 1, w: 0 });
    // 3x3 전체가 판이라 네 귀퉁이도 흑으로만 둘러싸여 흑집이 된다 (귀퉁이 4 + 중앙 사석 자리 1)
    expect(score.territory.b).toBe(5);
    expect(score.total).toEqual({ b: 6, w: 0 });
    expect(score.winner).toBe("b");
  });
});
