import { describe, it, expect } from 'vitest';
import {
  createGame,
  applyMove,
  undo,
  status,
  statusDetail,
  isThreefoldRepetition,
  positionKey,
  coordToSquare,
  squareToCoord,
  legalMoves,
} from '../src/index';
import type { Board, Color, GameState, Move } from '../src/index';

function emptyBoard(): Board {
  return new Array(64).fill(null);
}

/**
 * สร้าง GameState เริ่มต้นจากกระดาน + ฝ่ายที่กำหนด.
 * สำคัญ: ต้องสร้าง positions จากกระดานจริง (ไม่ใช่ของ createGame ที่เป็นกระดานเริ่มเกม)
 * มิฉะนั้น key ตำแหน่งเริ่มต้นจะผิด ทำให้การตรวจซ้ำสามครั้งเพี้ยน.
 */
function stateFrom(board: Board, turn: Color): GameState {
  return { board, turn, history: [], positions: [positionKey(board, turn)], counting: null };
}

function move(from: string, to: string): Move {
  return { from: coordToSquare(from), to: coordToSquare(to) };
}

describe('การซ้ำสามครั้ง (threefold repetition)', () => {
  it('ตำแหน่งซ้ำสามครั้ง → เสมอ (reason = repetition)', () => {
    // ขุน+เรือขาว vs ขุน+เรือดำ ; เดินเรือไปกลับให้ตำแหน่งซ้ำ
    const b = emptyBoard();
    b[coordToSquare('a1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('h1')] = { type: 'rua', color: 'white' };
    b[coordToSquare('a8')] = { type: 'khun', color: 'black' };
    b[coordToSquare('h8')] = { type: 'rua', color: 'black' };
    let s = stateFrom(b, 'white');

    // ตำแหน่งเริ่มต้น (white to move) = ครั้งที่ 1
    expect(isThreefoldRepetition(s)).toBe(false);

    // วนสองรอบ: ขาว h1->g1, ดำ h8->g8, ขาว g1->h1, ดำ g8->h8  → กลับสู่ตำแหน่งเดิม (ครั้งที่ 2)
    s = applyMove(s, move('h1', 'g1'));
    s = applyMove(s, move('h8', 'g8'));
    s = applyMove(s, move('g1', 'h1'));
    s = applyMove(s, move('g8', 'h8'));
    expect(isThreefoldRepetition(s)).toBe(false); // เพิ่งซ้ำครั้งที่ 2
    expect(status(s)).not.toBe('draw');

    // วนอีกหนึ่งรอบ → ตำแหน่งเดิมครั้งที่ 3
    s = applyMove(s, move('h1', 'g1'));
    s = applyMove(s, move('h8', 'g8'));
    s = applyMove(s, move('g1', 'h1'));
    s = applyMove(s, move('g8', 'h8'));

    expect(isThreefoldRepetition(s)).toBe(true);
    expect(status(s)).toBe('draw');
    expect(statusDetail(s).reason).toBe('repetition');
  });
});

/**
 * เส้นทาง "งู" ของเรือขาวบนแถวกระดาน 1..6 (rank index 1..6) ครบทุกไฟล์.
 * ทุกช่องที่ติดกันในลิสต์อยู่แถวเดียวกัน (เดินตามไฟล์) หรือไฟล์เดียวกัน (เดินข้ามแถว) →
 * เป็นตาเรือถูกกติกาเสมอ และทุกช่องไม่ซ้ำกัน (48 ช่อง) ทำให้ "ไม่เกิดการซ้ำตำแหน่ง"
 * ก่อนการนับจะถึงเพดาน — พิสูจน์เพดานการนับได้แยกจากกฎซ้ำสามครั้ง.
 */
function rookSnake(): string[] {
  const path: string[] = [];
  for (let rank = 1; rank <= 6; rank++) {
    const files = rank % 2 === 1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    for (const f of files) path.push(squareToCoord(f + rank * 8));
  }
  return path;
}

describe('นับศักดิ์กระดาน (board honor counting)', () => {
  it('ขุนเปล่า vs ขุน+เรือ → ต้องจบเสมอด้วยการนับภายในเพดาน 16 ตา', () => {
    // ดำเหลือขุนเปล่า (เสียเปรียบ) ; ขาวมีขุน+เรือ (ได้เปรียบ → ต้องรุกให้จน)
    // เรือขาวเดินวน "งู" ผ่านช่องไม่ซ้ำ (ไม่รุกจน, ไม่กิน) และขุนดำสลับ h8<->g8
    // เพื่อให้ฝ่ายได้เปรียบ (ขาว) เดินครบ 16 ตาโดยยังไม่จน → ตัดสินเสมอด้วยการนับ
    // (เลือกเส้นทางไม่ซ้ำตำแหน่ง เพื่อพิสูจน์เพดานการนับ ไม่ให้กฎซ้ำสามครั้งมาตัดก่อน)
    const snake = rookSnake();
    const b = emptyBoard();
    b[coordToSquare('a1')] = { type: 'khun', color: 'white' };
    b[coordToSquare(snake[0])] = { type: 'rua', color: 'white' };
    b[coordToSquare('h8')] = { type: 'khun', color: 'black' };
    let s = stateFrom(b, 'white');

    let drawReason: string | undefined;
    let i = 1;
    let cur = snake[0];
    for (let step = 0; step < 200; step++) {
      const d = statusDetail(s);
      if (d.status === 'draw') {
        drawReason = d.reason;
        break;
      }
      // กันทดสอบล้ม: ต้องไม่จน/อับ และไม่ถูกตัดด้วยกฎซ้ำก่อนถึงเพดานนับ
      expect(d.status === 'playing' || d.status === 'check').toBe(true);
      expect(isThreefoldRepetition(s)).toBe(false);

      if (s.turn === 'white') {
        const next = snake[i++ % snake.length];
        s = applyMove(s, move(cur, next));
        cur = next;
      } else {
        // ดำ: สลับขุน h8 <-> g8 (อยู่ไกลเรือ ไม่ถูกรุก)
        const kAt = s.board[coordToSquare('h8')] ? 'h8' : 'g8';
        s = applyMove(s, move(kAt, kAt === 'h8' ? 'g8' : 'h8'));
      }
    }

    expect(drawReason).toBe('counting');
    // ตรวจว่าเสมอด้วยการนับ (ไม่ใช่ซ้ำสามครั้ง) และเพดานถูกต้อง (เรือ 1 ตัว → 16 ตาของฝ่ายได้เปรียบ)
    expect(isThreefoldRepetition(s)).toBe(false);
    expect(s.counting).not.toBeNull();
    expect(s.counting!.limitMoves).toBe(16);
    expect(s.counting!.countingFor).toBe('white');
  });

  it('เพดานการนับขึ้นกับหมากที่แรงที่สุดของฝ่ายได้เปรียบ', () => {
    // เรือ 1 ตัว → 16
    {
      const b = emptyBoard();
      b[coordToSquare('a1')] = { type: 'khun', color: 'white' };
      b[coordToSquare('c2')] = { type: 'rua', color: 'white' };
      b[coordToSquare('h8')] = { type: 'khun', color: 'black' };
      const s = applyMove(stateFrom(b, 'white'), move('c2', 'd2'));
      expect(s.counting?.limitMoves).toBe(16);
    }
    // ม้า 1 ตัว → 64
    {
      const b = emptyBoard();
      b[coordToSquare('a1')] = { type: 'khun', color: 'white' };
      b[coordToSquare('c2')] = { type: 'ma', color: 'white' };
      b[coordToSquare('h8')] = { type: 'khun', color: 'black' };
      const s = applyMove(stateFrom(b, 'white'), move('c2', 'd4'));
      expect(s.counting?.limitMoves).toBe(64);
    }
    // เรือ 2 ตัว → 8
    {
      const b = emptyBoard();
      b[coordToSquare('a1')] = { type: 'khun', color: 'white' };
      b[coordToSquare('c2')] = { type: 'rua', color: 'white' };
      b[coordToSquare('e2')] = { type: 'rua', color: 'white' };
      b[coordToSquare('h8')] = { type: 'khun', color: 'black' };
      const s = applyMove(stateFrom(b, 'white'), move('c2', 'd2'));
      expect(s.counting?.limitMoves).toBe(8);
    }
  });

  it('การกินตัวรีเซ็ตการนับ (เริ่มนับใหม่); เดินเฉย ๆ ไม่รีเซ็ต', () => {
    // ขาว: ขุน + เรือ 2 ; ดำ: ขุน + เรือ 1 (ไม่มีเบี้ย → เข้าเงื่อนไข "พักกระดาน", ขาวเป็นฝ่ายได้เปรียบ)
    const b = emptyBoard();
    b[coordToSquare('a1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('b1')] = { type: 'rua', color: 'white' };
    b[coordToSquare('d4')] = { type: 'rua', color: 'white' };
    b[coordToSquare('a8')] = { type: 'khun', color: 'black' };
    b[coordToSquare('d6')] = { type: 'rua', color: 'black' };
    let s = stateFrom(b, 'white');

    // เดินเรือขาวเฉย ๆ (ไม่กิน) → เริ่มนับให้ฝ่ายได้เปรียบ (ขาว, เรือ 2 ตัว → เพดาน 8)
    s = applyMove(s, move('b1', 'b2'));
    expect(s.counting).not.toBeNull();
    expect(s.counting!.countingFor).toBe('white');
    expect(s.counting!.limitMoves).toBe(8);
    const startPlyStart = s.counting!.startPly;

    // ดำเดินเรือเฉย ๆ — เดินที่ไม่กิน ต้องไม่รีเซ็ต startPly
    s = applyMove(s, move('d6', 'd5'));
    expect(s.counting!.startPly).toBe(startPlyStart);

    // ขาวกินเรือดำ (d4 x d5) — วัสดุเปลี่ยน ต้องรีเซ็ตการนับ (startPly ขยับมาที่ ply ปัจจุบัน)
    s = applyMove(s, move('d4', 'd5'));
    expect(s.counting).not.toBeNull();
    expect(s.counting!.startPly).toBe(s.history.length); // เริ่มนับใหม่ ณ ตำแหน่งหลังกิน
    expect(s.counting!.startPly).toBeGreaterThan(startPlyStart);
    // ตอนนี้ดำเหลือขุนเปล่า ขาวยังเรือ 2 ตัว → เพดานยัง 8
    expect(s.counting!.countingFor).toBe('white');
    expect(s.counting!.limitMoves).toBe(8);
  });
});

describe('เกมปกติยังจบด้วยการรุกจน', () => {
  it('ลำดับการเดินที่นำไปสู่รุกจน → checkmate (กฎเสมอไม่ตัดก่อน)', () => {
    // K+เรือ 2 ตัว ไล่ขุนดำ: ขุนขาว c1, เรือ a7 (คุมแถว 7 ขุนดำลงไม่ได้), เรือ h2, ขุนดำ e8.
    // เรือ h2 -> h8 = รุกจนบนแถว 8 (ขุนดำที่ e8 ไปไหนไม่ได้: แถว 8 ถูกเรือคุม, แถว 7 ถูกเรือ a7 คุม).
    const b = emptyBoard();
    b[coordToSquare('c1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('a7')] = { type: 'rua', color: 'white' };
    b[coordToSquare('h2')] = { type: 'rua', color: 'white' };
    b[coordToSquare('e8')] = { type: 'khun', color: 'black' };
    let s = stateFrom(b, 'white');

    // ก่อนเดิน: ยังเล่นได้ตามปกติ (ไม่ถูกตัดเป็นเสมอด้วยกฎใด ๆ)
    const before = statusDetail(s);
    expect(before.status === 'playing' || before.status === 'check').toBe(true);

    // เดินตาที่รุกจนจริง
    s = applyMove(s, move('h2', 'h8'));

    // กฎเสมอ (นับ/ซ้ำ) ต้องไม่ลัดตัดก่อน — ผลต้องเป็นรุกจน
    const d = statusDetail(s);
    expect(d.status).toBe('checkmate');
    expect(d.reason).toBe('checkmate');
    expect(legalMoves(s.board, 'black').length).toBe(0);
  });

  it('รุกจนจริงให้ reason = checkmate', () => {
    const b = emptyBoard();
    b[coordToSquare('a1')] = { type: 'khun', color: 'white' };
    b[coordToSquare('a8')] = { type: 'rua', color: 'black' };
    b[coordToSquare('b8')] = { type: 'rua', color: 'black' };
    b[coordToSquare('e5')] = { type: 'khun', color: 'black' };
    const s = stateFrom(b, 'white');
    expect(status(s)).toBe('checkmate');
    expect(statusDetail(s).reason).toBe('checkmate');
  });
});

describe('undo ไม่ทำให้ positions/counting เพี้ยน', () => {
  it('undo แล้ว positions และ counting ตรงกับการเดินใหม่', () => {
    let s = createGame();
    s = applyMove(s, move('e3', 'e4'));
    s = applyMove(s, move('e6', 'e5'));
    const beforeUndoPositions = [...s.positions];

    s = applyMove(s, move('d3', 'd4'));
    // undo กลับมาเท่ากับก่อนหน้า (สร้างใหม่จากประวัติ — positions ต้องตรงกัน)
    const back = undo(s);
    expect(back.positions).toEqual(beforeUndoPositions);
    expect(back.history.length).toBe(2);
  });
});
