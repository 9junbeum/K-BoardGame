// 윷놀이 순수 게임 로직 — 렌더링과 분리, 테스트 가능
//
// 보드: 29개 노드
//   0        : 출발/도착 (참먹이). 한 바퀴 돌아 0에 서면 다음 이동으로 완주.
//   1..19    : 바깥 둘레 (5, 10, 15는 모서리)
//   20,21    : 모서리 5 → 중앙 지름길
//   22       : 중앙 (방)
//   23,24    : 중앙 → 모서리 15 지름길
//   25,26    : 모서리 10 → 중앙 지름길
//   27,28    : 중앙 → 0 지름길
// 지름길 규칙: 모서리(5, 10)나 중앙(22)에 "정확히 멈춘" 말만 다음 이동에서 지름길 진입.
// 중앙에 멈춘 말은 최단 경로(27→28→0)로 나간다.

export const FINISH = -1;

export type YutResult = "backdo" | "do" | "gae" | "geol" | "yut" | "mo";

export const RESULT_STEPS: Record<YutResult, number> = {
  backdo: -1,
  do: 1,
  gae: 2,
  geol: 3,
  yut: 4,
  mo: 5,
};

export const YUT_RESULT_LABEL: Record<YutResult, string> = {
  backdo: "빽도",
  do: "도",
  gae: "개",
  geol: "걸",
  yut: "윷",
  mo: "모",
};

/** 윷·모는 한 번 더 던진다 */
export function grantsExtraThrow(result: YutResult): boolean {
  return result === "yut" || result === "mo";
}

export interface YutRules {
  /** 플레이어당 말 개수 (2~4) */
  pieceCount: number;
  /** 빽도 사용 여부 */
  backdo: boolean;
}

export const DEFAULT_YUT_RULES: YutRules = { pieceCount: 4, backdo: true };

export interface YutPiece {
  /** "ready"(대기) | 노드 번호 | "done"(완주) */
  pos: number | "ready" | "done";
  /** 지나온 노드 기록 (가상 출발점 0 포함, 마지막 = 현재 위치) */
  trail: number[];
}

export interface YutState {
  /** 턴 순서 (player_id, 입장 순) */
  order: string[];
  pieces: Record<string, YutPiece[]>;
  /** 아직 말에 적용하지 않은 던지기 결과 */
  pending: YutResult[];
  /** 현재 턴 플레이어가 남은 던지기 횟수 */
  throwsLeft: number;
  /** 마지막 던지기 (연출용) */
  lastThrow: { by: string; result: YutResult; sticks: boolean[]; at: number } | null;
}

export function createYutState(order: string[], rules: YutRules): YutState {
  const pieces: Record<string, YutPiece[]> = {};
  for (const id of order) {
    pieces[id] = Array.from({ length: rules.pieceCount }, () => ({
      pos: "ready" as const,
      trail: [],
    }));
  }
  return { order, pieces, pending: [], throwsLeft: 1, lastThrow: null };
}

/**
 * 윷가락 4개 던지기. sticks[i] = true → 배(평평한 면).
 * 빽도 규칙 사용 시 0번 가락에 표식이 있다고 가정: 배가 딱 하나이고 그게 0번이면 빽도.
 */
export function throwSticks(
  rules: YutRules,
  rand: () => number = Math.random,
): { result: YutResult; sticks: boolean[] } {
  const sticks = Array.from({ length: 4 }, () => rand() < 0.5);
  const flats = sticks.filter(Boolean).length;
  let result: YutResult;
  if (flats === 0) result = "mo";
  else if (flats === 4) result = "yut";
  else if (flats === 2) result = "gae";
  else if (flats === 3) result = "geol";
  else result = rules.backdo && sticks[0] ? "backdo" : "do";
  return { result, sticks };
}

/** 던진 결과를 대기열에 반영 */
export function applyThrow(
  state: YutState,
  by: string,
  result: YutResult,
  sticks: boolean[],
  at: number = Date.now(),
): YutState {
  return {
    ...state,
    pending: [...state.pending, result],
    throwsLeft: state.throwsLeft - 1 + (grantsExtraThrow(result) ? 1 : 0),
    lastThrow: { by, result, sticks, at },
  };
}

/** prev → cur 로 온 말이 다음 칸으로 이동. isFirst = 이번 이동의 첫 걸음(직전에 cur에 멈춰 있었음) */
function nextNode(prev: number, cur: number, isFirst: boolean): number {
  switch (cur) {
    case 5:
      return isFirst ? 20 : 6;
    case 10:
      return isFirst ? 25 : 11;
    case 22:
      if (isFirst) return 27; // 중앙에 멈췄던 말 → 최단 경로
      return prev === 21 ? 23 : 27; // 5쪽 대각선 직진 / 10쪽 대각선 직진
    case 20:
      return 21;
    case 21:
      return 22;
    case 23:
      return 24;
    case 24:
      return 15;
    case 25:
      return 26;
    case 26:
      return 22;
    case 27:
      return 28;
    case 28:
      return 0;
    case 19:
      return 0;
    case 0:
      return FINISH; // 한 바퀴 돈 말이 0에서 또 이동 → 완주
    default:
      return cur + 1;
  }
}

/**
 * 말 하나의 목적지 계산. 이동 불가(빽도인데 판 위에 없음 등)면 null.
 * steps: RESULT_STEPS 값 (-1 = 빽도)
 */
export function computeDestination(
  piece: YutPiece,
  steps: number,
): { pos: number | "done"; trail: number[] } | null {
  if (piece.pos === "done") return null;

  if (steps === -1) {
    // 빽도: 판 위의 말만, 지나온 길로 한 칸 뒤로
    if (typeof piece.pos !== "number") return null;
    if (piece.trail.length <= 1) return null; // 0에서는 더 물러날 곳 없음
    const trail = piece.trail.slice(0, -1);
    return { pos: trail[trail.length - 1], trail };
  }

  // 참먹이(0)에 서 있는 말은 어떤 결과로도 완주
  if (piece.pos === 0) return { pos: "done", trail: [...piece.trail] };

  const entering = piece.pos === "ready";
  const trail: number[] = entering ? [0] : [...piece.trail];

  for (let i = 1; i <= steps; i++) {
    const cur = trail[trail.length - 1];
    const prev = trail.length >= 2 ? trail[trail.length - 2] : -99;
    let nxt: number;
    if (entering && i === 1) {
      nxt = 1; // 새 말 투입: 첫 걸음은 항상 1번 칸
    } else {
      nxt = nextNode(prev, cur, i === 1 && !entering);
    }
    if (nxt === FINISH) {
      return { pos: "done", trail };
    }
    trail.push(nxt);
  }
  return { pos: trail[trail.length - 1], trail };
}

/** 해당 결과를 적용할 수 있는 대상이 하나라도 있는지 */
export function canApplyResult(state: YutState, playerId: string, result: YutResult): boolean {
  const myPieces = state.pieces[playerId] ?? [];
  const steps = RESULT_STEPS[result];
  if (steps > 0) {
    return myPieces.some((p) => p.pos !== "done");
  }
  // 빽도: 판 위의 말이 있고 물러날 곳이 있어야
  return myPieces.some((p) => computeDestination(p, -1) !== null);
}

export interface ApplyYutMove {
  state: YutState;
  /** 상대 말을 잡아 한 번 더 던지게 됨 */
  captured: boolean;
  /** 이 수로 모든 말이 완주 */
  won: boolean;
}

/**
 * pending에서 result 하나를 꺼내 말(pieceIndex 또는 "new")에 적용.
 * 같은 칸의 내 말(업힌 말)은 함께 이동. 도착 칸의 상대 말은 잡아서 대기로.
 */
export function applyYutMove(
  state: YutState,
  playerId: string,
  target: number | "new",
  result: YutResult,
): ApplyYutMove | null {
  const pi = state.pending.indexOf(result);
  if (pi === -1) return null;
  const myPieces = state.pieces[playerId];
  if (!myPieces) return null;
  const steps = RESULT_STEPS[result];

  let indices: number[];
  let mover: YutPiece;
  if (target === "new") {
    if (steps < 0) return null;
    const idx = myPieces.findIndex((p) => p.pos === "ready");
    if (idx === -1) return null;
    indices = [idx];
    mover = myPieces[idx];
  } else {
    const piece = myPieces[target];
    if (!piece || typeof piece.pos !== "number") return null;
    mover = piece;
    // 같은 칸의 내 말은 업혀서 함께 이동
    indices = myPieces
      .map((p, i) => (typeof p.pos === "number" && p.pos === piece.pos ? i : -1))
      .filter((i) => i >= 0);
  }

  const dest = computeDestination(mover, steps);
  if (!dest) return null;

  const pieces: Record<string, YutPiece[]> = {};
  for (const [pid, arr] of Object.entries(state.pieces)) {
    pieces[pid] = arr.map((p) => ({ pos: p.pos, trail: [...p.trail] }));
  }
  for (const i of indices) {
    pieces[playerId][i] = { pos: dest.pos, trail: [...dest.trail] };
  }

  // 잡기
  let captured = false;
  if (typeof dest.pos === "number") {
    for (const [pid, arr] of Object.entries(pieces)) {
      if (pid === playerId) continue;
      for (const p of arr) {
        if (p.pos === dest.pos) {
          p.pos = "ready";
          p.trail = [];
          captured = true;
        }
      }
    }
  }

  const pending = [...state.pending];
  pending.splice(pi, 1);

  const won = pieces[playerId].every((p) => p.pos === "done");

  return {
    state: {
      ...state,
      pieces,
      pending,
      throwsLeft: state.throwsLeft + (captured ? 1 : 0),
    },
    captured,
    won,
  };
}

/** 현재 턴이 끝났는지 (던질 것도, 적용할 결과도 없음) */
export function isTurnOver(state: YutState): boolean {
  return state.throwsLeft <= 0 && state.pending.length === 0;
}

/** 다음 턴 플레이어 */
export function nextPlayer(state: YutState, current: string): string {
  const i = state.order.indexOf(current);
  return state.order[(i + 1) % state.order.length];
}

/** 노드 좌표 (SVG 렌더링용, 6x6 그리드 단위) */
export const NODE_COORDS: Record<number, { x: number; y: number }> = {
  0: { x: 5, y: 5 },
  1: { x: 5, y: 4 },
  2: { x: 5, y: 3 },
  3: { x: 5, y: 2 },
  4: { x: 5, y: 1 },
  5: { x: 5, y: 0 },
  6: { x: 4, y: 0 },
  7: { x: 3, y: 0 },
  8: { x: 2, y: 0 },
  9: { x: 1, y: 0 },
  10: { x: 0, y: 0 },
  11: { x: 0, y: 1 },
  12: { x: 0, y: 2 },
  13: { x: 0, y: 3 },
  14: { x: 0, y: 4 },
  15: { x: 0, y: 5 },
  16: { x: 1, y: 5 },
  17: { x: 2, y: 5 },
  18: { x: 3, y: 5 },
  19: { x: 4, y: 5 },
  20: { x: 4.17, y: 0.83 },
  21: { x: 3.33, y: 1.67 },
  22: { x: 2.5, y: 2.5 },
  23: { x: 1.67, y: 3.33 },
  24: { x: 0.83, y: 4.17 },
  25: { x: 0.83, y: 0.83 },
  26: { x: 1.67, y: 1.67 },
  27: { x: 3.33, y: 3.33 },
  28: { x: 4.17, y: 4.17 },
};
