// 사목(커넥트포) 순수 게임 로직 — 오목과 같은 패턴, 아래서부터 쌓이는 4목
// 규칙: 7열×6행, 흑 선공. 열을 고르면 그 열에서 가장 아래 빈 칸에 떨어진다.
// 가로/세로/대각선으로 4개가 이어지면 승리. 판이 다 차면 무승부.
import type { FirstMove } from "@/games/omok/logic";

export const COLS = 7;
export const ROWS = 6;

export type StoneColor = "b" | "w";
export type Cell = StoneColor | null;
export type Board = Cell[]; // 길이 COLS*ROWS, index = y * COLS + x

export interface Point {
  x: number;
  y: number;
}

export interface Move extends Point {
  c: StoneColor;
}

export interface GameState {
  moves: Move[];
}

export interface WinResult {
  color: StoneColor;
  line: Point[];
}

export interface SagmokRules {
  /** 흑선(선공)을 누가 잡을지: 랜덤 / 방장 / 상대 */
  firstMove: FirstMove;
}

export const DEFAULT_SAGMOK_RULES: SagmokRules = { firstMove: "random" };

export function idx(x: number, y: number): number {
  return y * COLS + x;
}

export function inRange(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

export function emptyBoard(): Board {
  return new Array<Cell>(COLS * ROWS).fill(null);
}

export function boardFromMoves(moves: Move[]): Board {
  const board = emptyBoard();
  for (const m of moves) {
    board[idx(m.x, m.y)] = m.c;
  }
  return board;
}

/** 다음에 둘 돌 색 (흑 선공) */
export function nextColor(moves: Move[]): StoneColor {
  return moves.length % 2 === 0 ? "b" : "w";
}

/** x열에서 다음 돌이 떨어질 y좌표. 가득 찼으면 null */
export function dropRow(board: Board, x: number): number | null {
  if (x < 0 || x >= COLS) return null;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[idx(x, y)] === null) return y;
  }
  return null;
}

const DIRS: Point[] = [
  { x: 1, y: 0 }, // 가로
  { x: 0, y: 1 }, // 세로
  { x: 1, y: 1 }, // 대각 ↘
  { x: 1, y: -1 }, // 대각 ↗
];

/** 마지막 착수 (x, y) 기준으로 4목 이상 완성 여부 판정 */
export function checkWin(board: Board, x: number, y: number): WinResult | null {
  const c = board[idx(x, y)];
  if (!c) return null;

  for (const d of DIRS) {
    const line: Point[] = [{ x, y }];
    let nx = x + d.x;
    let ny = y + d.y;
    while (inRange(nx, ny) && board[idx(nx, ny)] === c) {
      line.push({ x: nx, y: ny });
      nx += d.x;
      ny += d.y;
    }
    nx = x - d.x;
    ny = y - d.y;
    while (inRange(nx, ny) && board[idx(nx, ny)] === c) {
      line.unshift({ x: nx, y: ny });
      nx -= d.x;
      ny -= d.y;
    }
    if (line.length >= 4) {
      return { color: c, line };
    }
  }
  return null;
}

export function isDraw(moves: Move[]): boolean {
  return moves.length >= COLS * ROWS;
}

export interface ApplyResult {
  state: GameState;
  win: WinResult | null;
  draw: boolean;
}

/**
 * x열에 돌을 떨어뜨려 새 상태를 반환한다. 그 열이 가득 찼으면 null.
 * 원본 state는 변경하지 않는다.
 */
export function applyDrop(state: GameState, x: number): ApplyResult | null {
  const board = boardFromMoves(state.moves);
  const y = dropRow(board, x);
  if (y === null) return null;
  const c = nextColor(state.moves);
  const moves = [...state.moves, { x, y, c }];
  board[idx(x, y)] = c;
  const win = checkWin(board, x, y);
  return { state: { moves }, win, draw: !win && isDraw(moves) };
}
