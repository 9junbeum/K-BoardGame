import { describe, expect, it } from "vitest";
import {
  createDeck,
  createMemoryState,
  GRID_DIMS,
  pickCard,
  timeoutTurn,
  type GridSize,
} from "./logic";

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("덱 생성", () => {
  it.each<[GridSize, number]>([
    ["2x3", 3],
    ["3x4", 6],
    ["4x5", 10],
    ["5x6", 15],
  ])("%s 배열은 짝이 %i쌍이다", (grid, pairs) => {
    const deck = createDeck(grid, seq([0]));
    const { rows, cols } = GRID_DIMS[grid];
    expect(deck.length).toBe(rows * cols);
    const counts = new Map<string, number>();
    for (const s of deck) counts.set(s, (counts.get(s) ?? 0) + 1);
    expect(counts.size).toBe(pairs);
    for (const c of counts.values()) expect(c).toBe(2);
  });
});

describe("카드 뒤집기", () => {
  it("첫 장은 그냥 뒤집히고 턴이 끝나지 않는다", () => {
    const state = createMemoryState("2x3", 15, seq([0]));
    const r = pickCard(state, 0, "p1", 15)!;
    expect(r.turnEnded).toBe(false);
    expect(r.gameOver).toBe(false);
    expect(r.state.revealed).toEqual([0]);
  });

  it("두 번째 장이 짝이 맞으면 확정되고 같은 사람이 계속 둔다", () => {
    // 셔플 무의미하게: rand가 항상 0을 반환하면 셔플은 원소를 그대로 유지 X (아래에서 실제 값 확인)
    const state = createMemoryState("2x3", 15, () => 0);
    const first = pickCard(state, 0, "p1", 15)!.state;
    // 0번과 같은 기호를 가진 인덱스를 찾는다
    const partner = first.deck.findIndex((s, i) => i !== 0 && s === first.deck[0]);
    const r = pickCard(first, partner, "p1", 15)!;
    expect(r.turnEnded).toBe(false);
    expect(r.state.matched.sort()).toEqual([0, partner].sort());
    expect(r.state.scores.p1).toBe(1);
    expect(r.state.revealed).toEqual([]);
  });

  it("두 번째 장이 짝이 안 맞으면 턴이 끝나고 점수가 오르지 않는다", () => {
    const state = createMemoryState("2x3", 15, () => 0);
    const first = pickCard(state, 0, "p1", 15)!.state;
    const mismatch = first.deck.findIndex((s, i) => i !== 0 && s !== first.deck[0]);
    const r = pickCard(first, mismatch, "p1", 15)!;
    expect(r.turnEnded).toBe(true);
    expect(r.state.matched).toEqual([]);
    expect(r.state.scores.p1 ?? 0).toBe(0);
    expect(r.state.revealed).toEqual([]);
    expect(r.state.lastReveal).toMatchObject({ a: 0, b: mismatch, matchedNow: false, by: "p1" });
  });

  it("이미 맞춘 카드나 이미 뒤집힌 카드는 다시 고를 수 없다", () => {
    const state = createMemoryState("2x3", 15, () => 0);
    const first = pickCard(state, 0, "p1", 15)!.state;
    expect(pickCard(first, 0, "p1", 15)).toBeNull();

    const partner = first.deck.findIndex((s, i) => i !== 0 && s === first.deck[0]);
    const matched = pickCard(first, partner, "p1", 15)!.state;
    expect(pickCard(matched, 0, "p2", 15)).toBeNull();
  });

  it("모든 짝을 맞추면 게임이 끝난다", () => {
    // 매번 카드 하나를 고른 뒤 그 짝을 정확히 찾아 뒤집어, 항상 매치되도록 진행한다
    let state = createMemoryState("2x3", 15, () => 0);
    let lastGameOver = false;
    for (let round = 0; round < 10 && state.matched.length < state.deck.length; round++) {
      const a = state.deck.findIndex((_, i) => !state.matched.includes(i));
      state = pickCard(state, a, "p1", 15)!.state;
      const b = state.deck.findIndex((s, i) => i !== a && s === state.deck[a] && !state.matched.includes(i));
      const r = pickCard(state, b, "p1", 15)!;
      state = r.state;
      lastGameOver = r.gameOver;
    }
    expect(state.matched.length).toBe(state.deck.length);
    expect(lastGameOver).toBe(true);
  });
});

describe("시간 초과", () => {
  it("뒤집던 카드가 도로 덮이고 턴이 끝난다(밖에서 current_turn을 넘김)", () => {
    const state = createMemoryState("2x3", 15, () => 0);
    const withOneRevealed = pickCard(state, 0, "p1", 15)!.state;
    const after = timeoutTurn(withOneRevealed, 15);
    expect(after.revealed).toEqual([]);
    expect(after.matched).toEqual(withOneRevealed.matched);
  });
});
