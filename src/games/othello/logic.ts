// 오셀로(리버시) 순수 게임 로직 — 렌더링과 완전히 분리, 테스트 가능
//
// 규칙: 8×8판, 흑이 선공. 상대 돌을 자기 돌 사이에 끼우는 자리에만 둘 수 있고,
// 끼인 상대 돌은 모두 자기 돌로 뒤집힌다. 둘 곳이 없으면 그 사람은 자동으로 차례를 건너뛰고
// (별도의 "패스" 조작 없음), 양쪽 다 둘 곳이 없으면 대국이 끝난다. 돌이 많은 쪽이 승리.
import type { FirstMove } from "@/games/omok/logic";

export const SIZE = 8;

export type StoneColor = "b" | "w";
export type Cell = StoneColor | null;
export type Board = Cell[]; // 길이 SIZE*SIZE, index = y * SIZE + x

export interface Point {
  x: number;
  y: number;
}

export interface OthelloRules {
  firstMove: FirstMove;
}

export const DEFAULT_OTHELLO_RULES: OthelloRules = { firstMove: "random" };

export interface OthelloMove extends Point {
  c: StoneColor;
}

export interface OthelloState {
  moves: OthelloMove[];
}

export function createOthelloState(): OthelloState {
  return { moves: [] };
}

export function idx(x: number, y: number): number {
  return y * SIZE + x;
}

export function inRange(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

export function initialBoard(): Board {
  const board: Board = new Array(SIZE * SIZE).fill(null);
  board[idx(3, 3)] = "w";
  board[idx(4, 4)] = "w";
  board[idx(3, 4)] = "b";
  board[idx(4, 3)] = "b";
  return board;
}

const DIRS: Point[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 },
  { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 },
  { x: -1, y: 1 }, { x: -1, y: -1 },
];

/** (x, y)에 color를 놓았을 때 뒤집히는 좌표들 (없으면 빈 배열 = 그 자리엔 둘 수 없음) */
export function flipsFor(board: Board, x: number, y: number, color: StoneColor): number[] {
  if (!inRange(x, y) || board[idx(x, y)] !== null) return [];
  const opponent: StoneColor = color === "b" ? "w" : "b";
  const flips: number[] = [];
  for (const d of DIRS) {
    const line: number[] = [];
    let cx = x + d.x;
    let cy = y + d.y;
    while (inRange(cx, cy) && board[idx(cx, cy)] === opponent) {
      line.push(idx(cx, cy));
      cx += d.x;
      cy += d.y;
    }
    if (line.length > 0 && inRange(cx, cy) && board[idx(cx, cy)] === color) {
      flips.push(...line);
    }
  }
  return flips;
}

/** color가 둘 수 있는 모든 자리 */
export function legalMoves(board: Board, color: StoneColor): Point[] {
  const moves: Point[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[idx(x, y)] !== null) continue;
      if (flipsFor(board, x, y, color).length > 0) moves.push({ x, y });
    }
  }
  return moves;
}

/** (x, y)에 color를 두고 뒤집기까지 반영한 새 판. 불법이면 null */
export function applyToBoard(
  board: Board,
  x: number,
  y: number,
  color: StoneColor,
): { board: Board; flips: number[] } | null {
  const flips = flipsFor(board, x, y, color);
  if (flips.length === 0) return null;
  const next = board.slice();
  next[idx(x, y)] = color;
  for (const p of flips) next[p] = color;
  return { board: next, flips };
}

export function countStones(board: Board): { b: number; w: number } {
  let b = 0;
  let w = 0;
  for (const c of board) {
    if (c === "b") b++;
    else if (c === "w") w++;
  }
  return { b, w };
}

export interface DerivedOthello {
  board: Board;
  /** 다음에 둘 색. 아무도 둘 곳이 없으면 null(대국 종료) */
  toMove: StoneColor | null;
  /** 직전 색이 둘 곳이 없어 건너뛰어졌는지 (안내 배너용) */
  skipped: boolean;
  gameOver: boolean;
  counts: { b: number; w: number };
  legal: Point[];
}

/** moves를 처음부터 재생해 현재 판/차례를 계산한다. 둘 곳 없는 차례는 자동으로 건너뛴다 */
export function deriveOthello(moves: OthelloMove[]): DerivedOthello {
  let board = initialBoard();
  for (const m of moves) {
    const r = applyToBoard(board, m.x, m.y, m.c);
    if (!r) continue; // 검증된 기보라면 발생하지 않음(방어적 처리)
    board = r.board;
  }

  const lastColor: StoneColor = moves.length === 0 ? "w" : (moves[moves.length - 1].c as StoneColor);
  let candidate: StoneColor = lastColor === "b" ? "w" : "b";
  let skipped = false;
  let legal = legalMoves(board, candidate);
  if (legal.length === 0) {
    skipped = true;
    const other: StoneColor = candidate === "b" ? "w" : "b";
    const otherLegal = legalMoves(board, other);
    if (otherLegal.length === 0) {
      return { board, toMove: null, skipped, gameOver: true, counts: countStones(board), legal: [] };
    }
    candidate = other;
    legal = otherLegal;
  }
  return { board, toMove: candidate, skipped, gameOver: false, counts: countStones(board), legal };
}

/** 한 수를 검증하고 새 moves 배열을 반환한다. 불법이거나 대국이 끝났으면 null */
export function applyPlace(moves: OthelloMove[], x: number, y: number): { moves: OthelloMove[] } | null {
  const d = deriveOthello(moves);
  if (d.toMove === null) return null;
  const r = applyToBoard(d.board, x, y, d.toMove);
  if (!r) return null;
  return { moves: [...moves, { x, y, c: d.toMove }] };
}

/** 오셀로판 표시용 화점 4개 (표준 8×8 표시 규칙) */
export const STAR_POINTS: Point[] = [
  { x: 2, y: 2 },
  { x: 5, y: 2 },
  { x: 2, y: 5 },
  { x: 5, y: 5 },
];
