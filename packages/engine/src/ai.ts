import type { Board, Color, Move, PieceType } from './types';
import { legalMoves, applyMoveToBoard, inCheck, opposite } from './rules';

/** ค่าหมากแบบหมากรุกไทย (เม็ด/โคนอ่อนกว่าหมากรุกสากล) */
const VALUE: Record<PieceType, number> = {
  khun: 1000,
  rua: 5,
  ma: 3,
  khon: 2.6,
  met: 2,
  bia: 1,
};

const MATE = 100000;

/** ประเมินกระดานจากมุมมองของ `color` (บวก = ดีต่อ color) */
function evaluate(board: Board, color: Color): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p) continue;
    let v = VALUE[p.type];
    // โบนัสคุมกลางกระดานเล็กน้อย
    const f = sq & 7;
    const r = sq >> 3;
    const dist = Math.abs(f - 3.5) + Math.abs(r - 3.5);
    v += (7 - dist) * 0.02;
    // เบี้ยยิ่งใกล้เลื่อนขั้นยิ่งมีค่า
    if (p.type === 'bia') {
      const adv = p.color === 'white' ? r : 7 - r;
      v += adv * 0.05;
    }
    score += p.color === color ? v : -v;
  }
  return score;
}

function captureValue(board: Board, m: Move): number {
  const t = board[m.to];
  return t ? VALUE[t.type] : 0;
}

/** เรียงตาเดิน: ตากินก่อน (ช่วย alpha-beta ตัดกิ่งได้เร็วขึ้น) */
function orderMoves(board: Board, moves: Move[]): Move[] {
  return moves
    .map((m) => ({ m, v: captureValue(board, m) }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.m);
}

function negamax(board: Board, color: Color, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(board, color);
  if (moves.length === 0) {
    return inCheck(board, color) ? -MATE - depth : 0; // ถูกรุกจน = แย่สุด ; อับ = เสมอ
  }
  if (depth === 0) return evaluate(board, color);

  let best = -Infinity;
  for (const m of orderMoves(board, moves)) {
    const nb = applyMoveToBoard(board, m);
    const score = -negamax(nb, opposite(color), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export interface AIResult {
  move: Move | null;
  score: number;
}

/**
 * เลือกตาเดินที่ดีที่สุดของฝ่าย color
 * @param depth ความลึกในการค้นหา (ปรับความยาก)
 * @param randomness สุ่มในกลุ่มตาที่คะแนนต่างกันไม่เกินค่านี้ (เพิ่มความหลากหลาย/ลดความเก่ง)
 */
export function chooseMove(board: Board, color: Color, depth: number, randomness = 0): AIResult {
  const moves = legalMoves(board, color);
  if (moves.length === 0) return { move: null, score: 0 };

  const ordered = orderMoves(board, moves);
  let bestScore = -Infinity;
  let candidates: Move[] = [];

  for (const m of ordered) {
    const nb = applyMoveToBoard(board, m);
    // ค้นแต่ละตาที่ราก แบบเต็ม (ไม่ตัดกิ่งระหว่างตาราก) เพื่อรวบรวมตาที่ดีพอ ๆ กัน
    const score = -negamax(nb, opposite(color), depth - 1, -Infinity, Infinity);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      candidates = [m];
    } else if (score >= bestScore - randomness - 1e-9) {
      candidates.push(m);
    }
  }

  const move = candidates[Math.floor(Math.random() * candidates.length)] ?? ordered[0];
  return { move, score: bestScore };
}

export interface Difficulty {
  depth: number;
  randomness: number;
}

export const DIFFICULTIES: Record<'easy' | 'medium' | 'hard', Difficulty> = {
  easy: { depth: 1, randomness: 1.0 },
  medium: { depth: 2, randomness: 0.25 },
  hard: { depth: 3, randomness: 0 },
};
