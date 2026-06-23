/** สีของผู้เล่น */
export type Color = 'white' | 'black';

/**
 * ชนิดหมากหมากรุกไทย
 * - khun = ขุน (King)
 * - met  = เม็ด (Ferz — เดินทแยง 1 ช่อง)
 * - khon = โคน (เดินทแยง 4 + ตรงหน้า 1)
 * - ma   = ม้า (Knight)
 * - rua  = เรือ (Rook)
 * - bia  = เบี้ย (Pawn)
 */
export type PieceType = 'khun' | 'met' | 'khon' | 'ma' | 'rua' | 'bia';

export interface Piece {
  type: PieceType;
  color: Color;
}

/** ดัชนีช่อง 0..63 ; file = sq & 7, rank = sq >> 3 (rank 0 = แถวหลังของฝ่ายขาว) */
export type Square = number;

/** กระดาน 64 ช่อง (null = ว่าง) */
export type Board = (Piece | null)[];

export interface Move {
  from: Square;
  to: Square;
  /** เบี้ยเลื่อนขั้นเป็นเม็ด */
  promotion?: boolean;
}

export interface MoveRecord {
  move: Move;
  piece: Piece;
  captured: Piece | null;
  promoted: boolean;
}

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export interface GameState {
  board: Board;
  turn: Color;
  history: MoveRecord[];
}

export const PIECE_TYPES: readonly PieceType[] = ['khun', 'met', 'khon', 'ma', 'rua', 'bia'];
