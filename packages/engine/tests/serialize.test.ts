import { describe, it, expect } from 'vitest';
import { coordToSquare, squareToCoord, decodeMove, squareAt } from '../src/index';

describe('coordToSquare', () => {
  it('แปลงพิกัดที่ถูกต้องได้ค่าเดิม', () => {
    expect(coordToSquare('a1')).toBe(squareAt(0, 0));
    expect(coordToSquare('e1')).toBe(squareAt(4, 0));
    expect(coordToSquare('h8')).toBe(squareAt(7, 7));
    expect(coordToSquare('d4')).toBe(squareAt(3, 3));
  });

  it('roundtrip กับ squareToCoord ครบทุกช่อง', () => {
    for (let sq = 0; sq < 64; sq++) {
      expect(coordToSquare(squareToCoord(sq))).toBe(sq);
    }
  });

  it('ปฏิเสธความยาวผิด', () => {
    expect(() => coordToSquare('')).toThrow();
    expect(() => coordToSquare('e')).toThrow();
    expect(() => coordToSquare('e44')).toThrow();
    expect(() => coordToSquare('e3e4')).toThrow();
  });

  it('ปฏิเสธไฟล์นอกช่วง a-h', () => {
    expect(() => coordToSquare('i1')).toThrow();
    expect(() => coordToSquare('z3')).toThrow();
    expect(() => coordToSquare('11')).toThrow();
  });

  it('ปฏิเสธแถวนอกช่วง 1-8', () => {
    expect(() => coordToSquare('a0')).toThrow();
    expect(() => coordToSquare('a9')).toThrow();
    expect(() => coordToSquare('ax')).toThrow();
  });
});

describe('decodeMove', () => {
  it('ถอดรหัสตาเดินปกติ', () => {
    expect(decodeMove('e3e4')).toEqual({ from: squareAt(4, 2), to: squareAt(4, 3) });
  });

  it('ถอดรหัสตาเลื่อนขั้น', () => {
    expect(decodeMove('a5a6+')).toEqual({ from: squareAt(0, 4), to: squareAt(0, 5), promotion: true });
  });

  it('ปฏิเสธ string ที่เพี้ยน (ผ่าน coordToSquare)', () => {
    expect(() => decodeMove('zzzz')).toThrow();
    expect(() => decodeMove('e3')).toThrow();
    expect(() => decodeMove('')).toThrow();
  });
});
