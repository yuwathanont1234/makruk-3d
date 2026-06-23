import { describe, it, expect } from 'vitest';
import { initialBoard, chooseMove, legalMoves, coordToSquare } from '../src/index';
import type { Board } from '../src/index';

function emptyBoard(): Board {
  return new Array(64).fill(null);
}

describe('AI', () => {
  it('คืนตาเดินที่ถูกกติกาจากตำแหน่งเริ่มต้น', () => {
    const b = initialBoard();
    const { move } = chooseMove(b, 'white', 2);
    expect(move).not.toBeNull();
    const legal = legalMoves(b, 'white').some((m) => m.from === move!.from && m.to === move!.to);
    expect(legal).toBe(true);
  });

  it('กินเรือที่ลอย (ไม่มีตัวป้องกัน)', () => {
    const b = emptyBoard();
    b[coordToSquare('e1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('h8')] = { type: 'khun', color: 'black' }; // ขุนดำอยู่ไกล กินคืนไม่ได้
    b[coordToSquare('d4')] = { type: 'rua', color: 'white' };
    b[coordToSquare('d7')] = { type: 'rua', color: 'black' }; // เรือดำลอย
    const { move } = chooseMove(b, 'white', 2);
    expect(move).not.toBeNull();
    expect(move!.to).toBe(coordToSquare('d7')); // ควรกินเรือ
  });
});
