import type { Board, Move, PieceType, Square } from './types';
import { fileOf, rankOf, squareAt } from './board';

const FILE_LETTERS = 'abcdefgh';

export function squareToCoord(sq: Square): string {
  return FILE_LETTERS[fileOf(sq)] + (rankOf(sq) + 1);
}

export function coordToSquare(coord: string): Square {
  const f = FILE_LETTERS.indexOf(coord[0]);
  const r = parseInt(coord.slice(1), 10) - 1;
  return squareAt(f, r);
}

/** เข้ารหัสตาเดินเป็นสตริงสั้น เช่น "e3e4" หรือ "a5a6+" (เลื่อนขั้น) — ใช้ส่งผ่าน network */
export function encodeMove(m: Move): string {
  return squareToCoord(m.from) + squareToCoord(m.to) + (m.promotion ? '+' : '');
}

export function decodeMove(s: string): Move {
  const from = coordToSquare(s.slice(0, 2));
  const to = coordToSquare(s.slice(2, 4));
  return s.endsWith('+') ? { from, to, promotion: true } : { from, to };
}

const TYPE_CHAR: Record<PieceType, string> = {
  khun: 'k',
  met: 'm',
  khon: 's',
  ma: 'n',
  rua: 'r',
  bia: 'p',
};
const CHAR_TYPE: Record<string, PieceType> = {
  k: 'khun',
  m: 'met',
  s: 'khon',
  n: 'ma',
  r: 'rua',
  p: 'bia',
};

/** เข้ารหัสกระดานเป็นสตริง 64 ตัวอักษร (ตัวพิมพ์ใหญ่=ขาว, เล็ก=ดำ, '.'=ว่าง) */
export function encodeBoard(board: Board): string {
  let s = '';
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p) {
      s += '.';
      continue;
    }
    const c = TYPE_CHAR[p.type];
    s += p.color === 'white' ? c.toUpperCase() : c;
  }
  return s;
}

export function decodeBoard(s: string): Board {
  const board: Board = new Array(64).fill(null);
  for (let sq = 0; sq < 64; sq++) {
    const c = s[sq];
    if (!c || c === '.') continue;
    const lower = c.toLowerCase();
    board[sq] = { type: CHAR_TYPE[lower], color: c === lower ? 'black' : 'white' };
  }
  return board;
}
