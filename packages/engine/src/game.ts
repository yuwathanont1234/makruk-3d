import type {
  Board,
  Color,
  CountingState,
  GameState,
  GameStatus,
  GameStatusDetail,
  Move,
  MoveRecord,
} from './types';
import { initialBoard } from './board';
import { legalMoves, inCheck, opposite, applyMoveToBoard } from './rules';
import { encodeBoard } from './serialize';

/** key ของตำแหน่ง = รูปกระดาน + ฝ่ายที่ถึงตาเดิน (ใช้ตรวจซ้ำสามครั้ง) */
export function positionKey(board: Board, turn: Color): string {
  return encodeBoard(board) + (turn === 'white' ? 'w' : 'b');
}

export function createGame(): GameState {
  const board = initialBoard();
  return {
    board,
    turn: 'white',
    history: [],
    positions: [positionKey(board, 'white')],
    counting: null,
  };
}

export function applyMove(state: GameState, move: Move): GameState {
  const piece = state.board[move.from]!;
  const captured = state.board[move.to] ?? null;
  const board = applyMoveToBoard(state.board, move);
  const record: MoveRecord = { move, piece, captured, promoted: !!move.promotion };
  const history = [...state.history, record];
  const turn = opposite(state.turn);
  return {
    board,
    turn,
    history,
    positions: [...state.positions, positionKey(board, turn)],
    counting: deriveCounting(board, turn, state.counting, captured, !!move.promotion, history.length),
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

// ────────────────────────────── นับศักดิ์กระดาน (board honor count) ──────────────────────────────

interface Material {
  rua: number;
  ma: number;
  khon: number;
  met: number;
  bia: number;
  total: number; // หมากทั้งหมดบนกระดาน (รวมขุน)
  kings: number;
}

function countMaterial(board: Board): { white: Material; black: Material } {
  const mk = (): Material => ({ rua: 0, ma: 0, khon: 0, met: 0, bia: 0, total: 0, kings: 0 });
  const white = mk();
  const black = mk();
  for (const p of board) {
    if (!p) continue;
    const m = p.color === 'white' ? white : black;
    m.total++;
    switch (p.type) {
      case 'khun':
        m.kings++;
        break;
      case 'rua':
        m.rua++;
        break;
      case 'ma':
        m.ma++;
        break;
      case 'khon':
        m.khon++;
        break;
      case 'met':
        m.met++;
        break;
      case 'bia':
        m.bia++;
        break;
    }
  }
  return { white, black };
}

/**
 * จำนวน "ตา" สูงสุดของการนับศักดิ์กระดาน (board honor count) สำหรับฝ่ายได้เปรียบ `strong`.
 * อ้างตารางมาตรฐานหมากรุกไทย (นับจากจำนวนหมากของฝ่ายรุก):
 *   เรือ 2 ตัว → 8, เรือ 1 ตัว → 16, โคน 2 ตัว → 22, ม้า 2 ตัว → 32,
 *   โคน 1 ตัว → 44, ม้า 1 ตัว → 64, ไม่มีหมากใหญ่ (เหลือเม็ด/เบี้ย) → 64.
 * ลำดับความสำคัญไล่จากหมากที่แรงสุด (เรือ > โคนคู่ > ม้าคู่ > โคนเดี่ยว > ม้าเดี่ยว > อื่น ๆ).
 * ถ้าไม่มีหมากเดินไกลเลยก็ยังให้เพดาน 64 ตาเพื่อรับประกันว่าเกม "จบเสมอ" แน่นอน.
 */
function honorLimitMoves(strong: Material): number {
  if (strong.rua >= 2) return 8;
  if (strong.rua === 1) return 16;
  if (strong.khon >= 2) return 22;
  if (strong.ma >= 2) return 32;
  if (strong.khon === 1) return 44;
  if (strong.ma === 1) return 64;
  return 64;
}

/**
 * คำนวณสถานะการนับใหม่หลังเดินหนึ่ง ply.
 * เริ่มนับเมื่อ: ฝ่ายหนึ่งเหลือแต่ขุน (อีกฝ่ายยังมีหมาก) — "นับศักดิ์กระดาน"
 *   หรือบนกระดานไม่เหลือเบี้ยทั้งสองฝ่ายแล้ว ("พักกระดาน")
 * รีเซ็ตเมื่อมีการกินหรือเลื่อนขั้น (วัสดุเปลี่ยน → ตั้งต้นนับใหม่ถ้ายังเข้าเงื่อนไข).
 * `historyLen` = ความยาว history หลังเดิน (จำนวน ply ที่เดินมาแล้ว) ใช้เป็น startPly.
 */
function deriveCounting(
  board: Board,
  turn: Color,
  prev: CountingState | null,
  captured: unknown,
  promoted: boolean,
  historyLen: number
): CountingState | null {
  const { white, black } = countMaterial(board);

  // เหลือขุนสองตัว — จัดการเป็น bare-kings ที่ status() ไม่ต้องนับ
  if (white.total === 1 && black.total === 1) return null;

  const materialChanged = !!captured || promoted;

  // หาฝ่ายได้เปรียบ + เงื่อนไขเริ่มนับ
  let strong: Material | null = null;
  let strongColor: Color | null = null;

  if (white.total === 1 && black.total > 1) {
    // ขาวเหลือขุนเปล่า → ดำเป็นฝ่ายรุก (นับศักดิ์กระดาน)
    strong = black;
    strongColor = 'black';
  } else if (black.total === 1 && white.total > 1) {
    strong = white;
    strongColor = 'white';
  } else if (white.bia === 0 && black.bia === 0) {
    // ไม่มีเบี้ยทั้งกระดาน (พักกระดาน) → ฝ่ายที่มีวัสดุมากกว่าต้องรุกให้จน
    if (white.total > black.total) {
      strong = white;
      strongColor = 'white';
    } else if (black.total > white.total) {
      strong = black;
      strongColor = 'black';
    } else {
      // วัสดุเท่ากันและไม่มีเบี้ย — ยังให้นับเพื่อรับประกันการจบ (ฝ่ายถึงตาเดินเป็นผู้ถูกนับ)
      strong = turn === 'white' ? black : white;
      strongColor = turn === 'white' ? 'black' : 'white';
    }
  }

  if (!strong || !strongColor) return null;

  const limitMoves = honorLimitMoves(strong);

  // คงสถานะเดิมไว้ถ้ายังนับฝ่ายเดิม และวัสดุไม่เปลี่ยน (กันรีเซ็ตโดยไม่จำเป็น)
  if (prev && prev.countingFor === strongColor && !materialChanged) {
    return { countingFor: strongColor, startPly: prev.startPly, limitMoves };
  }

  // เริ่มนับใหม่ (เพิ่งเข้าเงื่อนไข หรือเปลี่ยนฝ่าย หรือวัสดุเปลี่ยน)
  return { countingFor: strongColor, startPly: historyLen, limitMoves };
}

/**
 * จำนวน "ตา" (move) ของฝ่ายได้เปรียบ (countingFor) ที่เดินไปแล้วตั้งแต่เริ่มนับ.
 * ในกติกานับศักดิ์ ฝ่ายได้เปรียบคือผู้ที่ต้องรุกให้จนภายในจำนวนตาที่กำหนด —
 * จึงนับเฉพาะ ply ที่เป็นของฝ่ายนั้น (ขาวเดินใน ply index คู่, ดำใน ply index คี่ เพราะขาวเริ่มก่อนเสมอ).
 */
function movesElapsed(state: GameState): number {
  if (!state.counting) return 0;
  const startPly = state.counting.startPly;
  const totalPly = state.history.length;
  let moves = 0;
  for (let ply = startPly; ply < totalPly; ply++) {
    // ply index (0-based): ขาวเดินเมื่อคู่, ดำเมื่อคี่
    const mover: Color = ply % 2 === 0 ? 'white' : 'black';
    if (mover === state.counting.countingFor) moves++;
  }
  return moves;
}

// ────────────────────────────── การซ้ำของตำแหน่ง ──────────────────────────────

/** ตำแหน่งปัจจุบันเกิดซ้ำครบ 3 ครั้งแล้วหรือไม่ */
export function isThreefoldRepetition(state: GameState): boolean {
  // ทนทานต่อ state ที่สร้างแบบเก่า/ไม่มี positions (เช่น deserialize จากข้อมูลเดิม)
  const positions = state.positions ?? [];
  if (positions.length === 0) return false;
  const current = positions[positions.length - 1];
  let count = 0;
  for (const k of positions) if (k === current) count++;
  return count >= 3;
}

// ────────────────────────────── สถานะเกม ──────────────────────────────

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

/**
 * รายละเอียดสถานะเกม (รูปแบบใหม่ที่มี reason)
 * ลำดับการตัดสิน: รุกจน/อับ ก่อน แล้วค่อยเสมอด้วยกฎอื่น
 */
export function statusDetail(state: GameState): GameStatusDetail {
  const moves = legalMoves(state.board, state.turn);
  const checked = inCheck(state.board, state.turn);

  if (moves.length === 0) {
    return checked
      ? { status: 'checkmate', reason: 'checkmate' }
      : { status: 'stalemate', reason: 'stalemate' };
  }
  if (isBareKings(state.board)) return { status: 'draw', reason: 'bare-kings' };
  if (isThreefoldRepetition(state)) return { status: 'draw', reason: 'repetition' };
  if (state.counting && movesElapsed(state) >= state.counting.limitMoves) {
    return { status: 'draw', reason: 'counting' };
  }
  return { status: checked ? 'check' : 'playing' };
}

/**
 * สถานะเกม (API เดิม — คืนค่า GameStatus เหมือนเดิม เพื่อความเข้ากันได้ย้อนหลัง)
 * ถ้าต้องการเหตุผลให้ใช้ statusDetail()
 */
export function status(state: GameState): GameStatus {
  return statusDetail(state).status;
}

export function isGameOver(state: GameState): boolean {
  const s = status(state);
  return s === 'checkmate' || s === 'stalemate' || s === 'draw';
}

/** ผู้ชนะ (เรียกเมื่อ status เป็น checkmate); อื่น ๆ คืน null */
export function winner(state: GameState): Color | null {
  return status(state) === 'checkmate' ? opposite(state.turn) : null;
}
