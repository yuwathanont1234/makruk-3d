import { describe, it, expect } from 'vitest';
import {
  initialBoard,
  legalMoves,
  legalMovesFrom,
  inCheck,
  applyMoveToBoard,
  squareAt,
  coordToSquare,
  status,
  positionKey,
} from '../src/index';
import type { Board, Color, GameState } from '../src/index';

function emptyBoard(): Board {
  return new Array(64).fill(null);
}

/** สร้าง GameState สำหรับทดสอบจากกระดาน + ฝ่ายที่ถึงตา (เติมฟิลด์ที่เหลือให้ตรงกับกระดานจริง) */
function stateOf(board: Board, turn: Color): GameState {
  return { board, turn, history: [], positions: [positionKey(board, turn)], counting: null };
}

describe('ตำแหน่งเริ่มต้น', () => {
  it('มีหมาก 32 ตัว และขุน/เม็ดอยู่ถูกช่อง (ขุนเยื้องไฟล์)', () => {
    const b = initialBoard();
    expect(b.filter(Boolean).length).toBe(32);
    expect(b[squareAt(4, 0)]).toEqual({ type: 'khun', color: 'white' }); // e1
    expect(b[squareAt(3, 0)]).toEqual({ type: 'met', color: 'white' }); // d1
    expect(b[squareAt(3, 7)]).toEqual({ type: 'khun', color: 'black' }); // d8
    expect(b[squareAt(4, 7)]).toEqual({ type: 'met', color: 'black' }); // e8
  });

  it('ขาวมีตาเดินถูกกติกา 23 ตา และสมมาตรกับดำ', () => {
    const b = initialBoard();
    const white = legalMoves(b, 'white');
    const black = legalMoves(b, 'black');
    expect(white.length).toBe(23);
    expect(black.length).toBe(23);
    // ทุกตาต้องไม่ทำให้ขุนตัวเองถูกรุก
    for (const m of white) expect(inCheck(applyMoveToBoard(b, m), 'white')).toBe(false);
  });
});

describe('การเดินของหมากแต่ละตัว', () => {
  it('เบี้ยเดินตรงหน้า 1 ช่อง ไม่มีเดิน 2 ช่อง', () => {
    const b = initialBoard();
    const tos = legalMovesFrom(b, coordToSquare('a3')).map((m) => m.to);
    expect(tos).toContain(coordToSquare('a4'));
    expect(tos).not.toContain(coordToSquare('a5'));
  });

  it('ม้ากระโดดข้ามหมากได้', () => {
    const b = initialBoard();
    const tos = legalMovesFrom(b, coordToSquare('b1')).map((m) => m.to);
    expect(tos).toContain(coordToSquare('d2'));
  });

  it('เรือถูกเบี้ยตัวเองบัง', () => {
    const b = initialBoard();
    const tos = legalMovesFrom(b, coordToSquare('a1')).map((m) => m.to);
    expect(tos).toContain(coordToSquare('a2'));
    expect(tos).not.toContain(coordToSquare('a4'));
  });

  it('โคนเดินทแยง 4 ทิศ + ตรงหน้า 1 (รวม 5 ตา จากกลางกระดานว่าง)', () => {
    const b = emptyBoard();
    b[coordToSquare('d4')] = { type: 'khon', color: 'white' };
    b[coordToSquare('e1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('e8')] = { type: 'khun', color: 'black' };
    const tos = legalMovesFrom(b, coordToSquare('d4')).map((m) => m.to);
    expect(tos.sort()).toEqual(
      [
        coordToSquare('c5'),
        coordToSquare('e5'),
        coordToSquare('c3'),
        coordToSquare('e3'),
        coordToSquare('d5'), // ตรงหน้า (ขาว)
      ].sort()
    );
  });

  it('เบี้ยเลื่อนขั้นเป็นเม็ดเมื่อถึงแถวที่ 6', () => {
    const b = emptyBoard();
    b[coordToSquare('a5')] = { type: 'bia', color: 'white' };
    b[coordToSquare('e1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('e8')] = { type: 'khun', color: 'black' };
    const move = legalMovesFrom(b, coordToSquare('a5')).find((m) => m.to === coordToSquare('a6'));
    expect(move?.promotion).toBe(true);
    const nb = applyMoveToBoard(b, move!);
    expect(nb[coordToSquare('a6')]).toEqual({ type: 'met', color: 'white' });
  });
});

describe('การรุกและจบเกม', () => {
  it('ตรวจจับการรุก และห้ามเดินตาที่ทำให้ขุนยังถูกรุก', () => {
    const b = emptyBoard();
    b[coordToSquare('e1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('e8')] = { type: 'rua', color: 'black' }; // เรือดำรุกตามไฟล์ e
    b[coordToSquare('h8')] = { type: 'khun', color: 'black' };
    expect(inCheck(b, 'white')).toBe(true);
    const all = legalMoves(b, 'white');
    for (const m of all) expect(inCheck(applyMoveToBoard(b, m), 'white')).toBe(false);
    const kingTos = all.filter((m) => m.from === coordToSquare('e1')).map((m) => m.to);
    expect(kingTos).not.toContain(coordToSquare('e2')); // e2 ยังอยู่ในไฟล์ที่ถูกรุก
    expect(kingTos.sort()).toEqual(
      [coordToSquare('d1'), coordToSquare('d2'), coordToSquare('f1'), coordToSquare('f2')].sort()
    );
  });

  it('ตรวจจับรุกจน (checkmate)', () => {
    const b = emptyBoard();
    b[coordToSquare('a1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('a8')] = { type: 'rua', color: 'black' }; // คุมไฟล์ a (รุก + คุม a2)
    b[coordToSquare('b8')] = { type: 'rua', color: 'black' }; // คุมไฟล์ b (b1, b2)
    b[coordToSquare('e5')] = { type: 'khun', color: 'black' };
    const st: GameState = stateOf(b, 'white');
    expect(status(st)).toBe('checkmate');
  });

  it('ตรวจจับอับ (stalemate = เสมอ)', () => {
    const b = emptyBoard();
    b[coordToSquare('a1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('c2')] = { type: 'met', color: 'black' }; // คุม b1
    b[coordToSquare('b3')] = { type: 'khun', color: 'black' }; // คุม a2, b2
    const st: GameState = stateOf(b, 'white');
    expect(inCheck(b, 'white')).toBe(false);
    expect(status(st)).toBe('stalemate');
  });
});
