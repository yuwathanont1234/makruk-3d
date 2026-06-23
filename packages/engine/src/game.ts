import type { Board, Color, GameState, GameStatus, Move, MoveRecord } from './types';
import { initialBoard } from './board';
import { legalMoves, inCheck, opposite, applyMoveToBoard } from './rules';

export function createGame(): GameState {
  return { board: initialBoard(), turn: 'white', history: [] };
}

export function applyMove(state: GameState, move: Move): GameState {
  const piece = state.board[move.from]!;
  const captured = state.board[move.to] ?? null;
  const board = applyMoveToBoard(state.board, move);
  const record: MoveRecord = { move, piece, captured, promoted: !!move.promotion };
  return {
    board,
    turn: opposite(state.turn),
    history: [...state.history, record],
  };
}

/** ย้อนตาเดินล่าสุด (สร้างใหม่จากประวัติ — ปลอดภัยและตรงเสมอ) */
export function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const records = state.history.slice(0, -1);
  let s = createGame();
  for (const r of records) s = applyMove(s, r.move);
  return s;
}

/** เหลือแต่ขุนสองตัว = เสมอ */
export function isBareKings(board: Board): boolean {
  let count = 0;
  let kings = 0;
  for (const p of board) {
    if (!p) continue;
    count++;
    if (p.type === 'khun') kings++;
  }
  return count === 2 && kings === 2;
}

export function status(state: GameState): GameStatus {
  const moves = legalMoves(state.board, state.turn);
  const checked = inCheck(state.board, state.turn);
  if (moves.length === 0) return checked ? 'checkmate' : 'stalemate';
  if (isBareKings(state.board)) return 'draw';
  return checked ? 'check' : 'playing';
}

export function isGameOver(state: GameState): boolean {
  const s = status(state);
  return s === 'checkmate' || s === 'stalemate' || s === 'draw';
}

/** ผู้ชนะ (เรียกเมื่อ status เป็น checkmate); อื่น ๆ คืน null */
export function winner(state: GameState): Color | null {
  return status(state) === 'checkmate' ? opposite(state.turn) : null;
}
