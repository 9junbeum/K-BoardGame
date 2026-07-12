// 카드 뒤집기(짝 맞추기) 순수 게임 로직 — 렌더링과 완전히 분리, 테스트 가능
//
// 규칙: 카드를 두 장씩 뒤집어 같은 그림이면 그대로 확보하고 한 번 더(연속 턴),
// 다르면 도로 덮고 상대에게 차례가 넘어간다. 모든 짝을 다 맞추면 종료 —
// 더 많은 짝을 맞춘 쪽이 승리(동률이면 무승부). 각 턴(카드 한 장을 고르는 데)마다
// 제한 시간이 있고, 시간 안에 고르지 못하면 그대로 상대에게 차례가 넘어간다.

export type GridSize = "2x3" | "3x4" | "4x5" | "5x6";

export const GRID_DIMS: Record<GridSize, { rows: number; cols: number }> = {
  "2x3": { rows: 2, cols: 3 },
  "3x4": { rows: 3, cols: 4 },
  "4x5": { rows: 4, cols: 5 },
  "5x6": { rows: 5, cols: 6 },
};

export const GRID_SIZES: GridSize[] = ["2x3", "3x4", "4x5", "5x6"];

export const TURN_SECONDS_OPTIONS = [10, 15, 20, 30] as const;

export interface MemoryRules {
  grid: GridSize;
  /** 카드 한 장을 고르는 데 주어지는 제한 시간(초) */
  turnSeconds: number;
}

export const DEFAULT_MEMORY_RULES: MemoryRules = { grid: "4x5", turnSeconds: 15 };

/** 5x6(15쌍)까지 커버하는 기호 풀 */
export const SYMBOLS = [
  "🐯", "🐻", "🐼", "🦊", "🐸",
  "🐵", "🐶", "🐱", "🦁", "🐨",
  "🐷", "🐮", "🐰", "🐹", "🐔",
] as const;

export interface LastReveal {
  a: number;
  b: number;
  matchedNow: boolean;
  by: string;
  at: number;
}

export interface MemoryState {
  deck: string[];
  /** 짝이 맞아 확정된 칸 인덱스들 */
  matched: number[];
  /** 이번 턴에 뒤집힌 채로 판정을 기다리는 칸 (0개 또는 1개만 유지됨 — 2번째는 즉시 판정) */
  revealed: number[];
  /** player_id -> 맞춘 짝 수 */
  scores: Record<string, number>;
  /** 직전에 뒤집었던 두 장 (연출/확인용, 판정은 이미 반영된 상태) */
  lastReveal: LastReveal | null;
  /** 다음 행동을 해야 하는 마감 시각(ISO) */
  deadline: string;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(grid: GridSize, rand: () => number = Math.random): string[] {
  const { rows, cols } = GRID_DIMS[grid];
  const pairCount = (rows * cols) / 2;
  const symbols = SYMBOLS.slice(0, pairCount);
  return shuffle([...symbols, ...symbols], rand);
}

function deadlineAt(turnSeconds: number): string {
  return new Date(Date.now() + turnSeconds * 1000).toISOString();
}

export function createMemoryState(
  grid: GridSize,
  turnSeconds: number,
  rand: () => number = Math.random,
): MemoryState {
  return {
    deck: createDeck(grid, rand),
    matched: [],
    revealed: [],
    scores: {},
    lastReveal: null,
    deadline: deadlineAt(turnSeconds),
  };
}

export interface PickResult {
  state: MemoryState;
  /** 이 수로 상대에게 차례가 넘어가는지 (짝을 못 맞췄을 때만 true) */
  turnEnded: boolean;
  /** 모든 짝이 확정되어 대국이 끝났는지 */
  gameOver: boolean;
}

/** 카드 한 장을 뒤집는다. by = 뒤집는 player_id (짝을 맞췄을 때 점수 반영용). 불가능하면 null */
export function pickCard(
  state: MemoryState,
  cardIndex: number,
  by: string,
  turnSeconds: number,
): PickResult | null {
  if (cardIndex < 0 || cardIndex >= state.deck.length) return null;
  if (state.matched.includes(cardIndex)) return null;
  if (state.revealed.includes(cardIndex)) return null;

  if (state.revealed.length === 0) {
    return {
      state: { ...state, revealed: [cardIndex], deadline: deadlineAt(turnSeconds) },
      turnEnded: false,
      gameOver: false,
    };
  }

  const a = state.revealed[0];
  const b = cardIndex;
  const matchedNow = state.deck[a] === state.deck[b];
  const matched = matchedNow ? [...state.matched, a, b] : state.matched;
  const scores = matchedNow
    ? { ...state.scores, [by]: (state.scores[by] ?? 0) + 1 }
    : state.scores;
  const gameOver = matched.length === state.deck.length;

  return {
    state: {
      ...state,
      matched,
      scores,
      revealed: [],
      lastReveal: { a, b, matchedNow, by, at: Date.now() },
      deadline: deadlineAt(turnSeconds),
    },
    turnEnded: !matchedNow,
    gameOver,
  };
}

/** 제한 시간 초과 — 뒤집던 카드는 도로 덮이고 차례만 넘어간다 */
export function timeoutTurn(state: MemoryState, turnSeconds: number): MemoryState {
  return { ...state, revealed: [], deadline: deadlineAt(turnSeconds) };
}
