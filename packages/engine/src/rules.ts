import type { Board, Color, Move, Square } from './types';
import { fileOf, rankOf, squareAt, inBounds, forward, promotionRank } from './board';

type Dir = readonly [number, number]; // [dFile, dRank]

const DIAG: Dir[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ORTHO: Dir[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const ALL8: Dir[] = [...DIAG, ...ORTHO];
const KNIGHT: Dir[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

export const opposite = (c: Color): Color => (c === 'white' ? 'black' : 'white');

export function kingSquare(board: Board, color: Color): Square {
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (p && p.type === 'khun' && p.color === color) return sq;
  }
  return -1;
}

function addStep(board: Board, from: Square, f: number, r: number, color: Color, out: Move[]): void {
  if (!inBounds(f, r)) return;
  const to = squareAt(f, r);
  const t = board[to];
  if (!t || t.color !== color) out.push({ from, to });
}

function addSlide(board: Board, from: Square, df: number, dr: number, color: Color, out: Move[]): void {
  let f = fileOf(from) + df;
  let r = rankOf(from) + dr;
  while (inBounds(f, r)) {
    const to = squareAt(f, r);
    const t = board[to];
    if (!t) {
      out.push({ from, to });
    } else {
      if (t.color !== color) out.push({ from, to });
      break;
    }
    f += df;
    r += dr;
  }
}

function pushBia(out: Move[], from: Square, to: Square, color: Color, toRank: number): void {
  if (toRank === promotionRank(color)) out.push({ from, to, promotion: true });
  else out.push({ from, to });
}

/** ตาเดินดิบ (ยังไม่ตัดตาที่ทำให้ขุนตัวเองถูกรุก) ของหมากที่ช่อง sq */
export function pseudoMoves(board: Board, sq: Square): Move[] {
  const p = board[sq];
  if (!p) return [];
  const out: Move[] = [];
  const f = fileOf(sq);
  const r = rankOf(sq);

  switch (p.type) {
    case 'khun':
      for (const [df, dr] of ALL8) addStep(board, sq, f + df, r + dr, p.color, out);
      break;
    case 'met':
      for (const [df, dr] of DIAG) addStep(board, sq, f + df, r + dr, p.color, out);
      break;
    case 'khon': {
      for (const [df, dr] of DIAG) addStep(board, sq, f + df, r + dr, p.color, out);
      addStep(board, sq, f, r + forward(p.color), p.color, out); // ตรงไปข้างหน้า 1
      break;
    }
    case 'ma':
      for (const [df, dr] of KNIGHT) addStep(board, sq, f + df, r + dr, p.color, out);
      break;
    case 'rua':
      for (const [df, dr] of ORTHO) addSlide(board, sq, df, dr, p.color, out);
      break;
    case 'bia': {
      const fr = forward(p.color);
      // เดินตรงหน้า 1 ช่อง (เฉพาะช่องว่าง)
      if (inBounds(f, r + fr) && !board[squareAt(f, r + fr)]) {
        pushBia(out, sq, squareAt(f, r + fr), p.color, r + fr);
      }
      // กินทแยงหน้า
      for (const df of [-1, 1]) {
        const nf = f + df;
        const nr = r + fr;
        if (!inBounds(nf, nr)) continue;
        const to = squareAt(nf, nr);
        const t = board[to];
        if (t && t.color !== p.color) pushBia(out, sq, to, p.color, nr);
      }
      break;
    }
  }
  return out;
}

/** ช่อง `target` ถูกโจมตีโดยฝ่าย `by` หรือไม่ */
export function isAttacked(board: Board, target: Square, by: Color): boolean {
  const tf = fileOf(target);
  const tr = rankOf(target);
  const fwdBy = forward(by);

  // ม้า
  for (const [df, dr] of KNIGHT) {
    const f = tf + df;
    const r = tr + dr;
    if (!inBounds(f, r)) continue;
    const p = board[squareAt(f, r)];
    if (p && p.color === by && p.type === 'ma') return true;
  }
  // ขุน (ประชิด)
  for (const [df, dr] of ALL8) {
    const f = tf + df;
    const r = tr + dr;
    if (!inBounds(f, r)) continue;
    const p = board[squareAt(f, r)];
    if (p && p.color === by && p.type === 'khun') return true;
  }
  // เม็ด + โคน (ทแยง 1 ช่อง)
  for (const [df, dr] of DIAG) {
    const f = tf + df;
    const r = tr + dr;
    if (!inBounds(f, r)) continue;
    const p = board[squareAt(f, r)];
    if (p && p.color === by && (p.type === 'met' || p.type === 'khon')) return true;
  }
  // โคน เดินตรงหน้า: โคนฝ่าย by ที่อยู่ "ด้านหลัง" target จะโจมตีตรงมา
  {
    const f = tf;
    const r = tr - fwdBy;
    if (inBounds(f, r)) {
      const p = board[squareAt(f, r)];
      if (p && p.color === by && p.type === 'khon') return true;
    }
  }
  // เบี้ย กินทแยงหน้า
  for (const df of [-1, 1]) {
    const f = tf + df;
    const r = tr - fwdBy;
    if (!inBounds(f, r)) continue;
    const p = board[squareAt(f, r)];
    if (p && p.color === by && p.type === 'bia') return true;
  }
  // เรือ (ไล่แนวตรง)
  for (const [df, dr] of ORTHO) {
    let f = tf + df;
    let r = tr + dr;
    while (inBounds(f, r)) {
      const p = board[squareAt(f, r)];
      if (p) {
        if (p.color === by && p.type === 'rua') return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  return false;
}

/** เดินหมากบนสำเนากระดาน แล้วคืนกระดานใหม่ (ไม่แตะของเดิม) */
export function applyMoveToBoard(board: Board, move: Move): Board {
  const nb = board.slice();
  const p = nb[move.from]!;
  nb[move.to] = move.promotion ? { type: 'met', color: p.color } : p;
  nb[move.from] = null;
  return nb;
}

export function inCheck(board: Board, color: Color): boolean {
  const ks = kingSquare(board, color);
  if (ks < 0) return false;
  return isAttacked(board, ks, opposite(color));
}

/** ตาเดินถูกกติกาทั้งหมดของฝ่าย color */
export function legalMoves(board: Board, color: Color): Move[] {
  const moves: Move[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p || p.color !== color) continue;
    for (const m of pseudoMoves(board, sq)) {
      const nb = applyMoveToBoard(board, m);
      if (!inCheck(nb, color)) moves.push(m);
    }
  }
  return moves;
}

/** ตาเดินถูกกติกาของหมากที่ช่อง sq */
export function legalMovesFrom(board: Board, sq: Square): Move[] {
  const p = board[sq];
  if (!p) return [];
  const out: Move[] = [];
  for (const m of pseudoMoves(board, sq)) {
    const nb = applyMoveToBoard(board, m);
    if (!inCheck(nb, p.color)) out.push(m);
  }
  return out;
}
