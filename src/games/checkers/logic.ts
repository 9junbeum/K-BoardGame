// 체커(서양장기) 순수 게임 로직 — 렌더링과 완전히 분리, 테스트 가능
//
// 규칙(표준 American checkers): 8×8판의 어두운 칸에만 말을 두고 흑이 먼저 둔다.
// 일반 말은 대각선 앞으로 한 칸만 이동하고, 인접한 상대 말을 뛰어넘어(그 뒤 칸이 비어 있으면)
// 잡을 수 있다. 잡을 수 있는 수가 있으면 반드시 잡아야 하며(강제 잡기), 잡은 뒤 같은 말로
// 더 잡을 수 있으면 연속으로 잡아야 한다(연속 잡기). 맨 끝 줄에 도달하면 킹으로 승격되어
// 대각선 어느 방향으로든 한 칸 이동/점프할 수 있다. 상대가 둘 곳이 없으면(말이 없거나
// 모든 말이 막힘) 패배한다.
import type { FirstMove } from "@/games/omok/logic";

export const SIZE = 8;

export type PieceColor = "b" | "w";

export interface CheckerPiece {
  color: PieceColor;
  king: boolean;
}

export type Cell = CheckerPiece | null;
export type Board = Cell[]; // 길이 SIZE*SIZE, index = y * SIZE + x

export interface Point {
  x: number;
  y: number;
}

export interface CheckersRules {
  firstMove: FirstMove;
}

export const DEFAULT_CHECKERS_RULES: CheckersRules = { firstMove: "random" };

/** 한 턴 = 시작점부터 도착점까지의 전체 경로(단순 이동이면 2칸, 연속 잡기면 3칸 이상) */
export interface CheckersMove {
  color: PieceColor;
  path: Point[];
  captured: Point[];
  promoted: boolean;
}

export interface GameState {
  moves: CheckersMove[];
}

export function createCheckersState(): GameState {
  return { moves: [] };
}

export function idx(x: number, y: number): number {
  return y * SIZE + x;
}

export function inRange(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

/** 어두운 칸(말이 놓일 수 있는 칸)인지 */
export function isDark(x: number, y: number): boolean {
  return (x + y) % 2 === 1;
}

export function initialBoard(): Board {
  const board: Board = new Array(SIZE * SIZE).fill(null);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!isDark(x, y)) continue;
      if (y <= 2) board[idx(x, y)] = { color: "b", king: false };
      else if (y >= 5) board[idx(x, y)] = { color: "w", king: false };
    }
  }
  return board;
}

/** 승격되는 마지막 줄(흑은 아래로 내려가 y=7, 백은 위로 올라가 y=0) */
function isPromotionRow(color: PieceColor, y: number): boolean {
  return color === "b" ? y === SIZE - 1 : y === 0;
}

function pieceDirs(piece: CheckerPiece): Point[] {
  if (piece.king) {
    return [
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 },
    ];
  }
  return piece.color === "b"
    ? [
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ]
    : [
        { x: 1, y: -1 },
        { x: -1, y: -1 },
      ];
}

/** (x,y)의 말이 단순 이동(비점프)으로 갈 수 있는 칸들 */
export function simpleMovesFrom(board: Board, x: number, y: number): Point[] {
  const piece = board[idx(x, y)];
  if (!piece) return [];
  const out: Point[] = [];
  for (const d of pieceDirs(piece)) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (inRange(nx, ny) && board[idx(nx, ny)] === null) out.push({ x: nx, y: ny });
  }
  return out;
}

export interface CaptureOption {
  to: Point;
  captured: Point;
}

/** (x,y)의 말이 지금 당장 뛰어넘어 잡을 수 있는 자리들 */
export function captureMovesFrom(board: Board, x: number, y: number): CaptureOption[] {
  const piece = board[idx(x, y)];
  if (!piece) return [];
  const out: CaptureOption[] = [];
  for (const d of pieceDirs(piece)) {
    const mx = x + d.x;
    const my = y + d.y;
    const nx = x + 2 * d.x;
    const ny = y + 2 * d.y;
    if (!inRange(nx, ny)) continue;
    const mid = board[idx(mx, my)];
    if (mid && mid.color !== piece.color && board[idx(nx, ny)] === null) {
      out.push({ to: { x: nx, y: ny }, captured: { x: mx, y: my } });
    }
  }
  return out;
}

/** color 쪽에 지금 잡을 수 있는 수가 하나라도 있는지 (있으면 강제 잡기가 적용된다) */
export function anyCaptureAvailable(board: Board, color: PieceColor): boolean {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = board[idx(x, y)];
      if (p && p.color === color && captureMovesFrom(board, x, y).length > 0) return true;
    }
  }
  return false;
}

/** color 쪽이 지금 착수할 수 있는 말의 시작 칸들 (강제 잡기 규칙 반영) */
export function legalStartSquares(board: Board, color: PieceColor): Point[] {
  const forced = anyCaptureAvailable(board, color);
  const out: Point[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = board[idx(x, y)];
      if (!p || p.color !== color) continue;
      if (forced) {
        if (captureMovesFrom(board, x, y).length > 0) out.push({ x, y });
      } else if (simpleMovesFrom(board, x, y).length > 0) {
        out.push({ x, y });
      }
    }
  }
  return out;
}

export function countPieces(board: Board): { b: number; w: number } {
  let b = 0;
  let w = 0;
  for (const c of board) {
    if (c?.color === "b") b++;
    else if (c?.color === "w") w++;
  }
  return { b, w };
}

export interface DerivedCheckers {
  board: Board;
  toMove: PieceColor;
  gameOver: boolean;
  winner: PieceColor | null;
  counts: { b: number; w: number };
  forcedCapture: boolean;
  legalStarts: Point[];
}

/** moves를 처음부터 재생해 현재 판/차례를 계산한다 */
export function deriveCheckers(moves: CheckersMove[]): DerivedCheckers {
  const board = initialBoard();
  for (const m of moves) {
    const from = m.path[0];
    const to = m.path[m.path.length - 1];
    const piece = board[idx(from.x, from.y)];
    if (!piece) continue; // 검증된 기보라면 발생하지 않음(방어적 처리)
    board[idx(from.x, from.y)] = null;
    for (const c of m.captured) board[idx(c.x, c.y)] = null;
    board[idx(to.x, to.y)] = { color: piece.color, king: piece.king || isPromotionRow(piece.color, to.y) };
  }

  const toMove: PieceColor = moves.length % 2 === 0 ? "b" : "w";
  const counts = countPieces(board);
  const legalStarts = legalStartSquares(board, toMove);
  const forcedCapture = anyCaptureAvailable(board, toMove);
  const gameOver = counts[toMove] === 0 || legalStarts.length === 0;
  const winner = gameOver ? (toMove === "b" ? "w" : "b") : null;

  return { board, toMove, gameOver, winner, counts, forcedCapture, legalStarts };
}

/**
 * 완성된 한 수(path)를 검증하고 새 moves 배열을 반환한다.
 * path.length===2면 단순 이동, 그 이상이면 연속 잡기 경로. 규칙(강제 잡기, 연속 잡기 완주) 위반 시 null.
 */
export function applyPath(
  state: GameState,
  color: PieceColor,
  path: Point[],
): { state: GameState; captured: Point[]; promoted: boolean } | null {
  if (path.length < 2) return null;
  const derived = deriveCheckers(state.moves);
  if (derived.toMove !== color || derived.gameOver) return null;

  const board = derived.board;
  const start = path[0];
  const piece = board[idx(start.x, start.y)];
  if (!piece || piece.color !== color) return null;

  const working = board.slice();
  working[idx(start.x, start.y)] = null;
  const captured: Point[] = [];
  let cur = start;
  let king = piece.king;

  if (path.length === 2 && !derived.forcedCapture) {
    const dest = path[1];
    const ok = simpleMovesFrom(board, start.x, start.y).some((p) => p.x === dest.x && p.y === dest.y);
    if (!ok) return null;
    cur = dest;
  } else {
    for (let i = 1; i < path.length; i++) {
      working[idx(cur.x, cur.y)] = { color, king };
      const options = captureMovesFrom(working, cur.x, cur.y);
      const dest = path[i];
      const opt = options.find((o) => o.to.x === dest.x && o.to.y === dest.y);
      if (!opt) return null;
      captured.push(opt.captured);
      working[idx(opt.captured.x, opt.captured.y)] = null;
      working[idx(cur.x, cur.y)] = null;
      cur = dest;
      if (isPromotionRow(color, cur.y)) king = true;
    }
    working[idx(cur.x, cur.y)] = { color, king };
    // 연속 잡기는 더 이상 잡을 수 없을 때까지 계속해야 한다
    if (captureMovesFrom(working, cur.x, cur.y).length > 0) return null;
  }

  const finalKing = king || isPromotionRow(color, cur.y);
  const promoted = !piece.king && finalKing;
  const move: CheckersMove = { color, path, captured, promoted };
  return { state: { moves: [...state.moves, move] }, captured, promoted };
}
