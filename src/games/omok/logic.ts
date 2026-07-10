// 오목 순수 게임 로직 — 렌더링과 완전히 분리, 테스트 가능
export const SIZE = 15;

export type StoneColor = "b" | "w";
export type Cell = StoneColor | null;
export type Board = Cell[]; // 길이 SIZE*SIZE, index = y * SIZE + x

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

export function idx(x: number, y: number): number {
  return y * SIZE + x;
}

export function inRange(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

export function emptyBoard(): Board {
  return new Array<Cell>(SIZE * SIZE).fill(null);
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

export function canPlace(board: Board, x: number, y: number): boolean {
  return inRange(x, y) && board[idx(x, y)] === null;
}

const DIRS: Point[] = [
  { x: 1, y: 0 }, // 가로
  { x: 0, y: 1 }, // 세로
  { x: 1, y: 1 }, // 대각 ↘
  { x: 1, y: -1 }, // 대각 ↗
];

/** 마지막 착수 (x, y) 기준으로 5목 이상 완성 여부 판정 */
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
    if (line.length >= 5) {
      return { color: c, line };
    }
  }
  return null;
}

export function isDraw(moves: Move[]): boolean {
  return moves.length >= SIZE * SIZE;
}

export interface ApplyResult {
  state: GameState;
  win: WinResult | null;
  draw: boolean;
}

/**
 * 수를 두고 새 상태를 반환. 불가능한 수(범위 밖/이미 돌 있음)면 null.
 * 원본 state는 변경하지 않는다.
 */
export function applyMove(state: GameState, x: number, y: number): ApplyResult | null {
  const board = boardFromMoves(state.moves);
  if (!canPlace(board, x, y)) return null;
  const c = nextColor(state.moves);
  const moves = [...state.moves, { x, y, c }];
  board[idx(x, y)] = c;
  const win = checkWin(board, x, y);
  return { state: { moves }, win, draw: !win && isDraw(moves) };
}

/** 오목판 화점 5개 좌표 */
export const STAR_POINTS: Point[] = [
  { x: 3, y: 3 },
  { x: 11, y: 3 },
  { x: 7, y: 7 },
  { x: 3, y: 11 },
  { x: 11, y: 11 },
];
