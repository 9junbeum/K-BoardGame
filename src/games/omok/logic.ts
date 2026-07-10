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

export type FirstMove = "random" | "host" | "guest";

export interface Rules {
  /** 삼삼(쌍삼) 금지 — 한 수로 열린 3을 두 개 이상 만들 수 없음 */
  forbidDoubleThree: boolean;
  /** 흑선(선공)을 누가 잡을지: 랜덤 / 방장 / 상대 */
  firstMove: FirstMove;
}

export const DEFAULT_RULES: Rules = {
  forbidDoubleThree: false,
  firstMove: "random",
};

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

/**
 * (x, y)에 놓인 c 돌이 방향 d에서 "열린 3"에 포함되는지.
 * 열린 3 = 빈 칸 하나에 돌을 더 놓으면 양끝이 빈 4연속(열린 4)이 되는 모양.
 * 연속 삼(.XXX.)과 띈 삼(.X.XX. / .XX.X.)을 모두 포함한다.
 */
function isOpenThreeInDir(board: Board, x: number, y: number, c: StoneColor, d: Point): boolean {
  for (let off = -4; off <= 4; off++) {
    if (off === 0) continue;
    const gx = x + d.x * off;
    const gy = y + d.y * off;
    if (!inRange(gx, gy) || board[idx(gx, gy)] !== null) continue;

    board[idx(gx, gy)] = c; // 가상 착수
    let ok = false;

    // (x, y)를 포함하는 최대 연속 run 계산
    let sx = x;
    let sy = y;
    while (inRange(sx - d.x, sy - d.y) && board[idx(sx - d.x, sy - d.y)] === c) {
      sx -= d.x;
      sy -= d.y;
    }
    let len = 0;
    let cx = sx;
    let cy = sy;
    while (inRange(cx, cy) && board[idx(cx, cy)] === c) {
      len++;
      cx += d.x;
      cy += d.y;
    }

    if (len === 4) {
      // 가상 돌(g)이 run에 포함되어야 "3 → 열린 4"가 성립
      let inRun = false;
      for (let k = 0; k < 4; k++) {
        if (sx + d.x * k === gx && sy + d.y * k === gy) {
          inRun = true;
          break;
        }
      }
      if (inRun) {
        const bx = sx - d.x;
        const by = sy - d.y;
        const ax = sx + d.x * 4;
        const ay = sy + d.y * 4;
        ok =
          inRange(bx, by) && board[idx(bx, by)] === null &&
          inRange(ax, ay) && board[idx(ax, ay)] === null;
      }
    }

    board[idx(gx, gy)] = null; // 복원
    if (ok) return true;
  }
  return false;
}

/** (x, y)에 방금 놓인 돌이 만드는 열린 3의 개수 (방향 기준) */
export function countOpenThrees(board: Board, x: number, y: number): number {
  const c = board[idx(x, y)];
  if (!c) return 0;
  let count = 0;
  for (const d of DIRS) {
    if (isOpenThreeInDir(board, x, y, c, d)) count++;
  }
  return count;
}

/**
 * 삼삼 금지 위반 여부. 5목 완성 수는 금수가 아니다.
 */
export function isForbiddenMove(state: GameState, x: number, y: number, rules?: Rules | null): boolean {
  if (!rules?.forbidDoubleThree) return false;
  const board = boardFromMoves(state.moves);
  if (!canPlace(board, x, y)) return false;
  const c = nextColor(state.moves);
  board[idx(x, y)] = c;
  if (checkWin(board, x, y)) return false;
  return countOpenThrees(board, x, y) >= 2;
}

export interface ApplyResult {
  state: GameState;
  win: WinResult | null;
  draw: boolean;
}

/**
 * 수를 두고 새 상태를 반환. 불가능한 수(범위 밖/이미 돌 있음/금수)면 null.
 * 원본 state는 변경하지 않는다.
 */
export function applyMove(
  state: GameState,
  x: number,
  y: number,
  rules?: Rules | null,
): ApplyResult | null {
  const board = boardFromMoves(state.moves);
  if (!canPlace(board, x, y)) return null;
  if (isForbiddenMove(state, x, y, rules)) return null;
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
