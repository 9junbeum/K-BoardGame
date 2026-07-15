import { describe, expect, it } from "vitest";
import {
  applyCorrectGuess,
  applyTimeout,
  CATCHMIND_WORDS,
  createCatchmindState,
  DEFAULT_CATCHMIND_RULES,
  isCorrectGuess,
  normalizeGuess,
  pickWord,
} from "./logic";

const RULES = DEFAULT_CATCHMIND_RULES;

describe("시작 상태", () => {
  it("첫 입장자가 출제자이고 전원 0점으로 시작한다", () => {
    const s = createCatchmindState(["a", "b", "c"], RULES, () => 0);
    expect(s.drawer).toBe("a");
    expect(s.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(s.roundNo).toBe(1);
    expect(s.word).toBe(CATCHMIND_WORDS[0]);
  });

  it("마감 시각은 제한시간만큼 미래다", () => {
    const s = createCatchmindState(["a", "b"], { targetScore: 5, drawSeconds: 60 });
    const diff = new Date(s.deadline).getTime() - Date.now();
    expect(diff).toBeGreaterThan(55_000);
    expect(diff).toBeLessThanOrEqual(60_000);
  });
});

describe("정답 판정", () => {
  it("공백을 무시하고 비교한다", () => {
    expect(normalizeGuess("아이스 크림")).toBe("아이스크림");
    expect(isCorrectGuess("아이스크림", "아이스 크림")).toBe(true);
    expect(isCorrectGuess("사과", "사과 ")).toBe(true);
  });

  it("빈 문자열이나 오답은 정답이 아니다", () => {
    expect(isCorrectGuess("사과", "")).toBe(false);
    expect(isCorrectGuess("사과", "   ")).toBe(false);
    expect(isCorrectGuess("사과", "바나나")).toBe(false);
  });
});

describe("정답 처리", () => {
  it("맞힌 사람이 1점을 얻고 다음 출제자가 된다", () => {
    const s = createCatchmindState(["a", "b"], RULES, () => 0);
    const r = applyCorrectGuess(s, "b", RULES, () => 0.5);
    expect(r.state.scores.b).toBe(1);
    expect(r.state.drawer).toBe("b");
    expect(r.state.roundNo).toBe(2);
    expect(r.won).toBe(false);
  });

  it("목표 점수에 도달하면 won이 true다", () => {
    const s = createCatchmindState(["a", "b"], { targetScore: 2, drawSeconds: 60 }, () => 0);
    let r = applyCorrectGuess(s, "b", { targetScore: 2, drawSeconds: 60 });
    expect(r.won).toBe(false);
    r = applyCorrectGuess(r.state, "b", { targetScore: 2, drawSeconds: 60 });
    expect(r.won).toBe(true);
    expect(r.state.scores.b).toBe(2);
  });
});

describe("시간 초과", () => {
  it("점수 변동 없이 입장 순서상 다음 사람에게 넘어간다", () => {
    const s = createCatchmindState(["a", "b", "c"], RULES, () => 0);
    const next = applyTimeout(s, RULES);
    expect(next.drawer).toBe("b");
    expect(next.scores).toEqual(s.scores);
    expect(next.roundNo).toBe(2);
  });

  it("마지막 사람 다음은 첫 사람으로 돌아온다", () => {
    const s = { ...createCatchmindState(["a", "b", "c"], RULES), drawer: "c" };
    expect(applyTimeout(s, RULES).drawer).toBe("a");
  });
});

describe("제시어 뽑기", () => {
  it("rand에 따라 결정적으로 뽑힌다", () => {
    expect(pickWord(() => 0)).toBe(CATCHMIND_WORDS[0]);
    expect(pickWord(() => 0.999999)).toBe(CATCHMIND_WORDS[CATCHMIND_WORDS.length - 1]);
  });
});
