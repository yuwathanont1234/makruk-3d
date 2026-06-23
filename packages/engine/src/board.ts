import type { Board, Color, PieceType, Square } from './types';

export const FILES = 8;
export const RANKS = 8;

export const fileOf = (sq: Square): number => sq & 7;
export const rankOf = (sq: Square): number => sq >> 3;
export const squareAt = (file: number, rank: number): Square => rank * 8 + file;
export const inBounds = (file: number, rank: number): boolean =>
  file >= 0 && file < FILES && rank >= 0 && rank < RANKS;

/**
 * ตำแหน่งเริ่มต้นแบบดั้งเดิม:
 * ขุนสองฝ่ายเยื้องไฟล์กัน — ขุนขาวอยู่ e1, ขุนดำอยู่ d8 (ขุนเผชิญเม็ดฝ่ายตรงข้าม)
 */
const WHITE_BACK: PieceType[] = ['rua', 'ma', 'khon', 'met', 'khun', 'khon', 'ma', 'rua'];
const BLACK_BACK: PieceType[] = ['rua', 'ma', 'khon', 'khun', 'met', 'khon', 'ma', 'rua'];

export function initialBoard(): Board {
  const board: Board = new Array(64).fill(null);
  for (let f = 0; f < FILES; f++) {
    board[squareAt(f, 0)] = { type: WHITE_BACK[f], color: 'white' };
    board[squareAt(f, 7)] = { type: BLACK_BACK[f], color: 'black' };
    board[squareAt(f, 2)] = { type: 'bia', color: 'white' }; // เบี้ยขาวแถว 3
    board[squareAt(f, 5)] = { type: 'bia', color: 'black' }; // เบี้ยดำแถว 6
  }
  return board;
}

/** ทิศ "หน้า" ของแต่ละสี (หน่วยเป็น delta ของ rank) */
export const forward = (color: Color): number => (color === 'white' ? 1 : -1);

/** แถวที่เบี้ยเลื่อนขั้น (ขาว = rank 5 คือแถวที่ 6, ดำ = rank 2 คือแถวที่ 3) */
export const promotionRank = (color: Color): number => (color === 'white' ? 5 : 2);

export function cloneBoard(board: Board): Board {
  return board.slice();
}
