// 바둑 순수 게임 로직 — 렌더링과 완전히 분리, 테스트 가능
//
// 규칙 출처 요약 (AGA Concise Rules of Go / Wikipedia "Rules of Go"):
//  - 흑이 선공, 번갈아 착수. 상대 돌(들)이 자유(liberty)를 모두 잃으면 잡는다.
//  - 자충수(자신의 돌이 착수 직후 자유가 0이 되는 수)는 금지.
//  - 패(ko): 직전 수에서 돌 1개를 딴 자리에, 상대가 곧바로 돌 1개를 따서 되돌리는 수는 금지
//    (일본/한국식 "단순패" 규칙 — 한 수 쉬었다 두면 다시 둘 수 있음).
//  - 두 번 연속 패스로 대국 종료 → 죽은 돌에 대한 합의(사석 표시) 후 계가.
//  - 계가는 지역계수(일본/한국식): 점수 = 자기 집(빈 점) + 대국 중 사로잡은 돌 + 상대 사석 수.
//    백에게는 덤(komi)을 더한다.
import type { FirstMove } from "@/games/omok/logic";

export type StoneColor = "b" | "w";
export type Cell = StoneColor | null;
export type Board = Cell[]; // 길이 size*size, index = y * size + x

export interface Point {
  x: number;
  y: number;
}

export type BoardSize = 9 | 13 | 19;

export interface GoRules {
  boardSize: BoardSize;
  /** 백 덤 (지역계수 기준, 보통 6.5) */
  komi: number;
  firstMove: FirstMove;
}

export const DEFAULT_GO_RULES: GoRules = {
  boardSize: 19,
  komi: 6.5,
  firstMove: "random",
};

export type GoAction =
  | { type: "place"; x: number; y: number; c: StoneColor }
  | { type: "pass"; c: StoneColor };

/** 계가(사석 합의) 단계 상태 — 클릭으로 죽은 돌을 표시하고 양쪽이 확정해야 종료된다 */
export interface GoScoring {
  /** 죽은 돌로 표시된 좌표 인덱스 (공유 — 둘 중 누구든 토글 가능) */
  dead: number[];
  /** 현재 dead 표시에 확정(동의)한 player_id 목록. dead가 바뀌면 초기화된다 */
  confirmedBy: string[];
}

export interface GoScore {
  territory: { b: number; w: number };
  captures: { b: number; w: number };
  /** 계가 단계에서 죽은 돌로 합의되어 상대 포로가 된 개수 */
  deadRemoved: { b: number; w: number };
  total: { b: number; w: number };
  winner: StoneColor | "draw";
}

export interface GoState {
  moves: GoAction[];
  scoring: GoScoring | null;
  /** 계가 확정 후 최종 점수 (표시용) */
  result: GoScore | null;
}

export function createGoState(): GoState {
  return { moves: [], scoring: null, result: null };
}

export function idx(x: number, y: number, size: number): number {
  return y * size + x;
}

export function inRange(x: number, y: number, size: number): boolean {
  return x >= 0 && x < size && y >= 0 && y < size;
}

export function emptyBoard(size: number): Board {
  return new Array<Cell>(size * size).fill(null);
}

function neighborsOf(pos: number, size: number): number[] {
  const x = pos % size;
  const y = Math.floor(pos / size);
  const list: number[] = [];
  if (x > 0) list.push(pos - 1);
  if (x < size - 1) list.push(pos + 1);
  if (y > 0) list.push(pos - size);
  if (y < size - 1) list.push(pos + size);
  return list;
}

/** (start)를 포함하는 동색 연결 그룹과 그 자유(liberty) 집합 */
function groupInfo(board: Board, size: number, start: number): { stones: Set<number>; liberties: Set<number> } {
  const color = board[start];
  const stones = new Set<number>([start]);
  const liberties = new Set<number>();
  const stack = [start];
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    for (const n of neighborsOf(cur, size)) {
      const c = board[n];
      if (c === null) {
        liberties.add(n);
      } else if (c === color && !stones.has(n)) {
        stones.add(n);
        stack.push(n);
      }
    }
  }
  return { stones, liberties };
}

interface StepResult {
  board: Board;
  capturedCount: number;
  /** 패(ko) 규칙으로 다음 한 수 동안 막힐 좌표 (해당 없으면 null) */
  koPoint: number | null;
}

/**
 * (pos)에 color 돌을 놓는다: 상대 그룹 중 자유가 0이 된 것을 먼저 제거하고,
 * 그 다음 자신의 그룹이 자유를 갖는지 검사한다(자충수 금지). 불법이면 null.
 */
function stepPlace(board: Board, size: number, pos: number, color: StoneColor): StepResult | null {
  const next = board.slice();
  next[pos] = color;
  const opponent: StoneColor = color === "b" ? "w" : "b";

  let capturedCount = 0;
  let lastCapturedPos: number | null = null;
  const visitedOpponent = new Set<number>();
  for (const n of neighborsOf(pos, size)) {
    if (next[n] !== opponent || visitedOpponent.has(n)) continue;
    const { stones, liberties } = groupInfo(next, size, n);
    for (const s of stones) visitedOpponent.add(s);
    if (liberties.size === 0) {
      for (const s of stones) {
        next[s] = null;
        capturedCount++;
        lastCapturedPos = s;
      }
    }
  }

  const own = groupInfo(next, size, pos);
  if (own.liberties.size === 0) {
    return null; // 자충수 — 착수 불가
  }

  // 고전적인 패 모양: 돌 1개만 잡혔고, 방금 놓은 돌이 자유 1개짜리 외돌이면
  // 그 자유(=방금 딴 자리)에 상대가 곧바로 되따는 것을 다음 한 수 동안 금지
  const koPoint =
    capturedCount === 1 && own.stones.size === 1 && own.liberties.size === 1 ? lastCapturedPos : null;

  return { board: next, capturedCount, koPoint };
}

export interface DerivedGo {
  board: Board;
  /** 대국 중 사로잡은 돌 수 (색 기준 — 그 색이 잡은 개수) */
  captures: { b: number; w: number };
  koPoint: number | null;
  toMove: StoneColor;
  lastAction: GoAction | null;
}

/** moves 배열을 처음부터 재생해 현재 판 상태를 계산한다 */
export function deriveGo(moves: GoAction[], size: number): DerivedGo {
  let board = emptyBoard(size);
  const captures = { b: 0, w: 0 };
  let koPoint: number | null = null;
  for (const m of moves) {
    if (m.type === "pass") {
      koPoint = null;
      continue;
    }
    const pos = idx(m.x, m.y, size);
    const step = stepPlace(board, size, pos, m.c);
    if (!step) continue; // 검증된 기보라면 발생하지 않음(방어적 처리)
    board = step.board;
    captures[m.c] += step.capturedCount;
    koPoint = step.koPoint;
  }
  const toMove: StoneColor = moves.length % 2 === 0 ? "b" : "w";
  return { board, captures, koPoint, toMove, lastAction: moves.at(-1) ?? null };
}

/** 한 수를 검증하고 새 moves 배열을 반환한다. 불가능한 수(범위 밖/자리 있음/자충수/패)면 null */
export function applyPlace(
  moves: GoAction[],
  size: number,
  x: number,
  y: number,
): { moves: GoAction[] } | null {
  if (!inRange(x, y, size)) return null;
  const d = deriveGo(moves, size);
  const pos = idx(x, y, size);
  if (d.board[pos] !== null) return null;
  if (pos === d.koPoint) return null;
  const step = stepPlace(d.board, size, pos, d.toMove);
  if (!step) return null;
  return { moves: [...moves, { type: "place", x, y, c: d.toMove }] };
}

export function applyPass(moves: GoAction[]): { moves: GoAction[] } {
  const toMove: StoneColor = moves.length % 2 === 0 ? "b" : "w";
  return { moves: [...moves, { type: "pass", c: toMove }] };
}

/** 마지막 두 수가 모두 패스인지 (연속 2패스 = 대국 종료 신호) */
export function isDoublePass(moves: GoAction[]): boolean {
  const n = moves.length;
  return n >= 2 && moves[n - 1].type === "pass" && moves[n - 2].type === "pass";
}

/** 클릭한 좌표가 속한 그룹 전체를 죽은 돌 표시 집합에 토글한다 */
export function toggleDeadGroup(board: Board, size: number, dead: number[], pos: number): number[] {
  const color = board[pos];
  if (!color) return dead;
  const { stones } = groupInfo(board, size, pos);
  const deadSet = new Set(dead);
  const nowDead = !deadSet.has(pos);
  for (const s of stones) {
    if (nowDead) deadSet.add(s);
    else deadSet.delete(s);
  }
  return [...deadSet];
}

/**
 * 지역계수(일본/한국식) 계가.
 * 점수 = 집(빈 점, 한 색으로만 둘러싸인 영역) + 대국 중 사로잡은 돌 + 죽은 돌로 합의되어 얻은 포로.
 */
export function computeScore(
  board: Board,
  size: number,
  dead: number[],
  captures: { b: number; w: number },
  komi: number,
): GoScore {
  const deadSet = new Set(dead);
  const eff = board.slice();
  const deadRemoved = { b: 0, w: 0 };
  for (const p of deadSet) {
    const c = eff[p];
    if (!c) continue;
    eff[p] = null;
    if (c === "w") deadRemoved.b++; // 백 사석 → 흑의 포로
    else deadRemoved.w++; // 흑 사석 → 백의 포로
  }

  const visited = new Set<number>();
  const territory = { b: 0, w: 0 };
  for (let p = 0; p < eff.length; p++) {
    if (eff[p] !== null || visited.has(p)) continue;
    const region: number[] = [];
    const borders = new Set<StoneColor>();
    const stack = [p];
    visited.add(p);
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      region.push(cur);
      for (const n of neighborsOf(cur, size)) {
        if (eff[n] === null) {
          if (!visited.has(n)) {
            visited.add(n);
            stack.push(n);
          }
        } else {
          borders.add(eff[n] as StoneColor);
        }
      }
    }
    if (borders.size === 1) {
      const only = [...borders][0];
      if (only === "b") territory.b += region.length;
      else territory.w += region.length;
    }
  }

  const totalB = territory.b + captures.b + deadRemoved.b;
  const totalW = territory.w + captures.w + deadRemoved.w + komi;
  const winner: StoneColor | "draw" = totalB > totalW ? "b" : totalW > totalB ? "w" : "draw";

  return { territory, captures, deadRemoved, total: { b: totalB, w: totalW }, winner };
}

/** 화점(星) 좌표 — 표준 위치 */
export function starPoints(size: BoardSize): Point[] {
  if (size === 19) {
    const l = [3, 9, 15];
    return l.flatMap((y) => l.map((x) => ({ x, y })));
  }
  if (size === 13) {
    return [
      { x: 3, y: 3 },
      { x: 9, y: 3 },
      { x: 6, y: 6 },
      { x: 3, y: 9 },
      { x: 9, y: 9 },
    ];
  }
  return [
    { x: 2, y: 2 },
    { x: 6, y: 2 },
    { x: 4, y: 4 },
    { x: 2, y: 6 },
    { x: 6, y: 6 },
  ];
}
