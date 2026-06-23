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

/**
 * เหตุผลที่ทำให้เกมจบ (ใช้คู่กับ GameStatus เพื่ออธิบายว่าจบเพราะอะไร)
 * - checkmate  : รุกจน
 * - stalemate  : อับ (เสมอ)
 * - bare-kings : เหลือขุนสองตัว (เสมอ)
 * - repetition : ตำแหน่งซ้ำสามครั้ง (เสมอ)
 * - counting   : นับศักดิ์ครบกำหนดยังไม่จน (เสมอ)
 */
export type GameEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'bare-kings'
  | 'repetition'
  | 'counting';

/**
 * ผลลัพธ์แบบละเอียดของ status() — รูปแบบ additive ที่ไม่กระทบผู้ใช้เดิม
 * (ผู้ใช้เดิมเรียก status() แล้วได้ค่า GameStatus เหมือนเดิม; ถ้าต้องการเหตุผลให้เรียก statusDetail())
 */
export interface GameStatusDetail {
  status: GameStatus;
  /** มีค่าเฉพาะเมื่อเกมจบ (checkmate / stalemate / draw) มิฉะนั้นเป็น undefined */
  reason?: GameEndReason;
}

/**
 * สถานะการนับศักดิ์กระดาน (นับศักดิ์) — เก็บไว้ใน GameState เพื่อให้คำนวณซ้ำได้
 * เป็น null เมื่อยังไม่เข้าเงื่อนไขนับ
 */
export interface CountingState {
  /** ฝ่ายที่ต้องเป็นผู้รุกให้จน (ฝ่ายที่ได้เปรียบ) */
  countingFor: Color;
  /** ply (ครึ่งตา) ที่เริ่มนับ — อ้างอิงความยาว history ขณะเริ่มนับ */
  startPly: number;
  /** จำนวน "ตา" (move = นับของฝ่ายที่ถูกนับ) สูงสุดก่อนตัดสินเสมอ */
  limitMoves: number;
}

export interface GameState {
  board: Board;
  turn: Color;
  history: MoveRecord[];
  /**
   * ประวัติ key ของตำแหน่ง (board layout + side to move) ทุก ply รวมตำแหน่งเริ่มต้น
   * ความยาว = history.length + 1 ; ใช้ตรวจจับการซ้ำสามครั้ง
   */
  positions: string[];
  /** สถานะการนับศักดิ์ปัจจุบัน (null = ยังไม่นับ) */
  counting: CountingState | null;
}

export const PIECE_TYPES: readonly PieceType[] = ['khun', 'met', 'khon', 'ma', 'rua', 'bia'];
