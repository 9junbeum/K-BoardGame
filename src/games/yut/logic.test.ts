import { describe, expect, it } from "vitest";
import {
  applyThrow,
  applyYutMove,
  canApplyResult,
  computeDestination,
  createYutState,
  DEFAULT_YUT_RULES,
  isTurnOver,
  nextPlayer,
  throwSticks,
  type YutPiece,
  type YutState,
} from "./logic";

const P1 = "p1";
const P2 = "p2";

function fresh(order = [P1, P2]): YutState {
  return createYutState(order, DEFAULT_YUT_RULES);
}

function pieceAt(pos: number, trail?: number[]): YutPiece {
  return { pos, trail: trail ?? [0, pos] };
}

describe("던지기", () => {
  it("배 개수에 따라 도개걸윷모", () => {
    // rand < 0.5 → 배(true)
    const seq = (vals: number[]) => {
      let i = 0;
      return () => vals[i++];
    };
    expect(throwSticks(DEFAULT_YUT_RULES, seq([0.9, 0.9, 0.9, 0.9])).result).toBe("mo");
    expect(throwSticks(DEFAULT_YUT_RULES, seq([0.1, 0.1, 0.1, 0.1])).result).toBe("yut");
    expect(throwSticks(DEFAULT_YUT_RULES, seq([0.1, 0.1, 0.9, 0.9])).result).toBe("gae");
    expect(throwSticks(DEFAULT_YUT_RULES, seq([0.1, 0.1, 0.1, 0.9])).result).toBe("geol");
    // 표식 없는 가락 하나만 배 → 도
    expect(throwSticks(DEFAULT_YUT_RULES, seq([0.9, 0.1, 0.9, 0.9])).result).toBe("do");
    // 표식(0번) 가락만 배 → 빽도
    expect(throwSticks(DEFAULT_YUT_RULES, seq([0.1, 0.9, 0.9, 0.9])).result).toBe("backdo");
    // 빽도 규칙 꺼짐 → 도
    expect(
      throwSticks({ ...DEFAULT_YUT_RULES, backdo: false }, seq([0.1, 0.9, 0.9, 0.9])).result,
    ).toBe("do");
  });

  it("윷/모는 던질 기회가 하나 더", () => {
    let s = fresh();
    s = applyThrow(s, P1, "yut", [true, true, true, true]);
    expect(s.throwsLeft).toBe(1);
    expect(s.pending).toEqual(["yut"]);
    s = applyThrow(s, P1, "do", [false, true, false, false]);
    expect(s.throwsLeft).toBe(0);
    expect(s.pending).toEqual(["yut", "do"]);
  });
});

describe("이동 경로", () => {
  it("새 말 투입: 도 → 1번 칸", () => {
    const d = computeDestination({ pos: "ready", trail: [] }, 1);
    expect(d?.pos).toBe(1);
    expect(d?.trail).toEqual([0, 1]);
  });

  it("바깥길 직진", () => {
    const d = computeDestination(pieceAt(2, [0, 1, 2]), 2);
    expect(d?.pos).toBe(4);
  });

  it("모서리 5를 지나치면 바깥길 유지", () => {
    const d = computeDestination(pieceAt(4, [0, 1, 2, 3, 4]), 2); // 4→5→6
    expect(d?.pos).toBe(6);
  });

  it("모서리 5에 멈췄던 말은 지름길 진입", () => {
    const d = computeDestination(pieceAt(5, [0, 1, 2, 3, 4, 5]), 2); // 5→20→21
    expect(d?.pos).toBe(21);
  });

  it("5쪽 지름길에서 중앙을 지나치면 15 방향 직진", () => {
    // 20에 멈춘 말이 걸(3): 21→22→23
    const d = computeDestination(pieceAt(20, [0, 5, 20]), 3);
    expect(d?.pos).toBe(23);
  });

  it("중앙(22)에 멈췄던 말은 최단 경로(27)로", () => {
    const d = computeDestination(pieceAt(22, [0, 5, 20, 21, 22]), 2); // 22→27→28
    expect(d?.pos).toBe(28);
  });

  it("10쪽 지름길은 중앙 지나 0 방향", () => {
    // 25에 멈춘 말이 걸: 26→22→27
    const d = computeDestination(pieceAt(25, [0, 10, 25]), 3);
    expect(d?.pos).toBe(27);
  });

  it("19에서 개: 0을 지나며 완주", () => {
    const d = computeDestination(pieceAt(19, [0, 19]), 2); // 19→0→완주
    expect(d?.pos).toBe("done");
  });

  it("참먹이(0)에 선 말은 어떤 결과로도 완주", () => {
    const d = computeDestination(pieceAt(0, [0, 19, 0]), 5);
    expect(d?.pos).toBe("done");
  });

  it("빽도: 지나온 길로 한 칸 뒤로", () => {
    const d = computeDestination(pieceAt(21, [0, 5, 20, 21]), -1);
    expect(d?.pos).toBe(20);
    expect(d?.trail).toEqual([0, 5, 20]);
  });

  it("1에서 빽도 → 참먹이(0)", () => {
    const d = computeDestination(pieceAt(1, [0, 1]), -1);
    expect(d?.pos).toBe(0);
  });

  it("대기 말에는 빽도 불가", () => {
    expect(computeDestination({ pos: "ready", trail: [] }, -1)).toBeNull();
  });
});

describe("말 적용 (업기/잡기/완주)", () => {
  it("같은 칸의 내 말은 업혀서 함께 이동", () => {
    const s = fresh();
    s.pieces[P1][0] = pieceAt(3, [0, 1, 2, 3]);
    s.pieces[P1][1] = pieceAt(3, [0, 1, 2, 3]);
    s.pending = ["gae"];
    const r = applyYutMove(s, P1, 0, "gae");
    expect(r?.state.pieces[P1][0].pos).toBe(5);
    expect(r?.state.pieces[P1][1].pos).toBe(5);
  });

  it("상대 말을 잡으면 대기로 보내고 던질 기회 +1", () => {
    const s = fresh();
    s.pieces[P1][0] = pieceAt(3, [0, 1, 2, 3]);
    s.pieces[P2][0] = pieceAt(5, [0, 1, 2, 3, 4, 5]);
    s.pending = ["gae"];
    s.throwsLeft = 0;
    const r = applyYutMove(s, P1, 0, "gae");
    expect(r?.captured).toBe(true);
    expect(r?.state.pieces[P2][0].pos).toBe("ready");
    expect(r?.state.pieces[P2][0].trail).toEqual([]);
    expect(r?.state.throwsLeft).toBe(1);
  });

  it("모든 말이 완주하면 승리", () => {
    const s = createYutState([P1, P2], { pieceCount: 2, backdo: true });
    s.pieces[P1][0] = { pos: "done", trail: [] };
    s.pieces[P1][1] = pieceAt(0, [0, 19, 0]);
    s.pending = ["do"];
    const r = applyYutMove(s, P1, 1, "do");
    expect(r?.won).toBe(true);
  });

  it("pending에 없는 결과는 적용 불가", () => {
    const s = fresh();
    s.pieces[P1][0] = pieceAt(3);
    s.pending = ["do"];
    expect(applyYutMove(s, P1, 0, "gae")).toBeNull();
  });

  it("빽도는 판 위 말 없으면 적용 대상 없음", () => {
    const s = fresh();
    expect(canApplyResult(s, P1, "backdo")).toBe(false);
    expect(canApplyResult(s, P1, "do")).toBe(true);
  });
});

describe("턴 관리", () => {
  it("던질 것도 적용할 것도 없으면 턴 종료", () => {
    const s = fresh();
    expect(isTurnOver(s)).toBe(false); // throwsLeft 1
    s.throwsLeft = 0;
    expect(isTurnOver(s)).toBe(true);
    s.pending = ["do"];
    expect(isTurnOver(s)).toBe(false);
  });

  it("다음 플레이어 순환", () => {
    const s = createYutState(["a", "b", "c"], DEFAULT_YUT_RULES);
    expect(nextPlayer(s, "a")).toBe("b");
    expect(nextPlayer(s, "c")).toBe("a");
  });
});
