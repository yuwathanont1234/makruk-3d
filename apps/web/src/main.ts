import {
  createGame,
  applyMove,
  undo,
  status,
  winner,
  legalMovesFrom,
  encodeBoard,
  encodeMove,
  decodeMove,
  squareToCoord,
  opposite,
  DIFFICULTIES,
} from '@makruk/engine';
import type { Color, GameState, Move, Square } from '@makruk/engine';
import { BoardView } from './boardView';
import { SoundManager } from './audio/SoundManager';
import { SOUND_PACKS } from './audio/packs';
import { THEMES, getTheme, DEFAULT_THEME_ID } from './themes/registry';
import { createAiModelTheme } from './themes/gltfTheme';
import { Hud, type Diff, type Mode, type Side } from './ui/hud';
import { OnlineSession, genRoomCode } from './online/online';
import { onlineAvailable, getSupabase } from './online/supabaseClient';

// Service worker เฉพาะ production (PWA ติดตั้งได้/ออฟไลน์); ตอน dev ไม่ใช้ + ล้างของเก่าที่ค้าง
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
  }
}

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

// --- state ---
let state: GameState = createGame();
let themeWhite = getTheme(DEFAULT_THEME_ID);
let themeBlack = getTheme(DEFAULT_THEME_ID);
let mode: Mode = '2p';
let aiSide: Side = 'black';
let difficulty: Diff = 'medium';
let selected: Square | null = null;
let inputLocked = false;
let over = false;
let aiReqId = 0;

// ออนไลน์
let online: OnlineSession | null = null;
let myColor: Color = 'white';
let opponentPresent = false;

const sound = new SoundManager(themeWhite.defaultSoundPack);
const view = new BoardView(canvas, themeWhite, themeBlack, state.board);
const worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });

const hud = new Hud(uiRoot, {
  themes: THEMES.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji })),
  packs: SOUND_PACKS.map((p) => ({ id: p.id, name: p.name })),
  initial: { mode, difficulty, aiSide, themeId: themeWhite.id, blackThemeId: themeBlack.id, soundId: sound.packId, muted: false, volume: 0.6 },
  cb: {
    onMode: (m) => {
      if (mode === 'online' && m !== 'online' && online) {
        void online.leave();
        online = null;
        opponentPresent = false;
      }
      mode = m;
      hud.setMode(m);
      if (m === 'online') updateOnlineStatus();
      else newGame();
    },
    onDifficulty: (d) => {
      difficulty = d;
    },
    onAiSide: (s) => {
      aiSide = s;
      hud.setAiSide(s);
      newGame();
    },
    onTheme: (id) => void selectTheme(id),
    onSound: (id) => sound.setPack(id),
    onMute: (m) => {
      sound.setMuted(m);
      hud.setMuted(m);
    },
    onVolume: (v) => sound.setVolume(v),
    onNewGame: () => newGame(),
    onUndo: () => doUndo(),
    onCreateRoom: () => void createRoom(),
    onJoinRoom: (code) => void joinRoom(code),
    onAiTheme: () => void onAiTheme(),
    onBlackTheme: (id) => void selectTheme(id, 'black'),
  },
});

async function selectTheme(id: string, side: 'white' | 'black'): Promise<void> {
  const t = getTheme(id);
  if (t.preload) {
    hud.setStatus('กำลังโหลดโมเดล 3D…', 'normal');
    try {
      await t.preload();
    } catch {
      hud.setStatus('โหลดโมเดลไม่สำเร็จ', 'normal');
      return;
    }
  }
  if (side === 'black') {
    themeBlack = t;
  } else {
    themeWhite = t;
    sound.setPack(t.defaultSoundPack);
    hud.setSound(t.defaultSoundPack);
  }
  view.setThemes(themeWhite, themeBlack, state.board);
  refreshHighlights();
  updateHud();
}

async function onAiTheme(): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    window.alert('ยังไม่ได้ตั้งค่า Supabase (.env)');
    return;
  }
  const prompt = window.prompt('พิมพ์ธีมที่อยากได้ แล้ว AI จะสร้างตัวหมาก 3D ให้\n(เช่น โจรสลัด, อวกาศไซเบอร์, สัตว์ในตำนาน, นินจา):');
  if (!prompt) return;
  // เตือนก่อนเรียกบริการสร้างโมเดล (มีค่าใช้จ่าย/ใช้เวลานาน/ผลหายเมื่อรีโหลด)
  const ok = window.confirm(
    'การสร้างตัวหมาก 3D ด้วย AI:\n' +
      '• อาจใช้เวลาหลายนาที\n' +
      '• เป็นบริการที่มีค่าใช้จ่าย (paid generation)\n' +
      '• ผลลัพธ์จะหายไปเมื่อรีโหลดหน้า\n\n' +
      'ต้องการสร้างต่อหรือไม่?'
  );
  if (!ok) return;
  hud.setStatus('✨ AI กำลังสร้างโมเดล 3D… (อาจใช้เวลาหลายนาที)', 'normal');
  try {
    const res = await fetch(`${url}/functions/v1/generate-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || res.statusText);
    const t = createAiModelTheme(data.id || 'ai', data.name || prompt, data.models || {});
    hud.setStatus('✨ กำลังโหลดโมเดล…', 'normal');
    await t.preload?.();
    themeWhite = t;
    sound.setPack(t.defaultSoundPack);
    hud.setSound(t.defaultSoundPack);
    view.setThemes(themeWhite, themeBlack, state.board);
    refreshHighlights();
    updateHud();
  } catch (e) {
    hud.setStatus('สร้างธีมไม่สำเร็จ: ' + (e as Error).message, 'normal');
  }
}

view.onPick = onPick;

// ปลดล็อกเสียงเมื่อผู้ใช้โต้ตอบครั้งแรก
window.addEventListener('pointerdown', () => sound.unlock(), { once: true });

// --- helpers ---
const colorTH = (c: Color): string => (c === 'white' ? 'ขาว' : 'ดำ');

function humanTurn(): boolean {
  if (mode === 'ai') return state.turn !== aiSide;
  if (mode === 'online') return !!online && opponentPresent && state.turn === myColor;
  return true;
}

function select(sq: Square): void {
  selected = sq;
  view.clearSelection();
  view.showSelected(sq);
  const targets = legalMovesFrom(state.board, sq).map((m) => ({ to: m.to, capture: !!state.board[m.to] }));
  view.showTargets(targets);
  sound.play('select');
}

function deselect(): void {
  selected = null;
  view.clearSelection();
}

function refreshHighlights(): void {
  view.clearSelection();
  const last = state.history[state.history.length - 1];
  if (last) view.showLastMove(last.move.from, last.move.to);
  else view.clearLastMove();
  if (selected !== null) select(selected);
}

function onPick(sq: Square): void {
  sound.unlock();
  if (inputLocked || over || !humanTurn()) return;
  const piece = state.board[sq];

  if (selected === null) {
    if (piece && piece.color === state.turn) select(sq);
    return;
  }
  if (sq === selected) {
    deselect();
    return;
  }
  const mv = legalMovesFrom(state.board, selected).find((m) => m.to === sq);
  if (mv) {
    void humanMove(mv);
    return;
  }
  if (piece && piece.color === state.turn) {
    select(sq);
    return;
  }
  sound.play('illegal');
  deselect();
}

// แกนกลาง: เดินหมาก + อนิเมชัน + เสียง + อัปเดต HUD (ไม่ broadcast, ไม่เรียก AI)
async function applyAndAnimate(move: Move): Promise<void> {
  const piece = state.board[move.from]!;
  const captured = state.board[move.to] ?? null;

  inputLocked = true;
  deselect();
  if (captured) sound.play('capture', piece.type);
  else sound.play('move', piece.type);

  state = applyMove(state, move);
  await view.animateMove({
    move,
    movedType: piece.type,
    color: piece.color,
    isCapture: !!captured,
    capturedType: captured?.type ?? null,
    promoted: !!move.promotion,
  });
  view.showLastMove(move.from, move.to);
  if (move.promotion) sound.play('promote');
  updateHud();

  const st = status(state);
  if (st === 'check') sound.play('check');
  if (st === 'checkmate' || st === 'stalemate' || st === 'draw') {
    onGameOver(st);
    return;
  }
  inputLocked = false;
}

// ตาเดินจากผู้เล่นเครื่องนี้
async function humanMove(move: Move): Promise<void> {
  if (mode === 'online' && online) online.send('move', { ply: state.history.length, enc: encodeMove(move) });
  await applyAndAnimate(move);
  if (mode === 'ai' && !over && state.turn === aiSide) triggerAI();
}

/**
 * ตรวจว่าตาเดินที่ decode แล้วถูกกติกากับ state ปัจจุบันจริง —
 * `from` ต้องมีหมากของฝ่ายที่ถึงตาเดิน และ move ต้องอยู่ใน legalMovesFrom.
 * คืน Move ที่ "canonical" จาก engine (กัน flag promotion ที่ฝั่งส่งมาเพี้ยน) หรือ null ถ้าไม่ถูกกติกา
 */
function validateMove(s: GameState, mv: Move): Move | null {
  const piece = s.board[mv.from];
  if (!piece || piece.color !== s.turn) return null;
  return legalMovesFrom(s.board, mv.from).find((m) => m.to === mv.to && !!m.promotion === !!mv.promotion) ?? null;
}

// ตาเดินจากคู่ต่อสู้ออนไลน์
async function onRemoteMove(ply: number, enc: string): Promise<void> {
  if (mode !== 'online') return;
  if (ply !== state.history.length) {
    online?.send('hello', {}); // เพี้ยน → ขอ sync ใหม่จาก host
    return;
  }
  let mv: Move;
  try {
    mv = decodeMove(enc);
  } catch {
    hud.setStatus('ได้รับตาเดินที่ผิดรูปแบบ — ขอซิงก์ใหม่', 'normal');
    online?.send('hello', {});
    return;
  }
  const legal = validateMove(state, mv);
  if (!legal) {
    // ตาเดินไม่ถูกกติกา (อาจถูกแก้ไข/เพี้ยน) — ไม่เดิน เพื่อกัน state พัง แล้วขอซิงก์ใหม่
    console.warn('[online] ปฏิเสธตาเดินจาก network ที่ไม่ถูกกติกา:', enc);
    hud.setStatus('ปฏิเสธตาเดินที่ไม่ถูกกติกาจากคู่ต่อสู้', 'normal');
    online?.send('hello', {});
    return;
  }
  await applyAndAnimate(legal);
}

function triggerAI(): void {
  inputLocked = true;
  hud.setThinking(true);
  const reqId = ++aiReqId;
  const { depth, randomness } = DIFFICULTIES[difficulty];
  // หน่วงนิดหน่อยให้รู้สึกเป็นธรรมชาติ + ให้ UI อัปเดต
  setTimeout(() => {
    worker.postMessage({ id: reqId, boardStr: encodeBoard(state.board), color: state.turn, depth, randomness });
  }, 180);
}

worker.onmessage = (e: MessageEvent<{ id: number; move: Move | null }>): void => {
  const { id, move } = e.data;
  if (id !== aiReqId) return; // คำตอบเก่า ทิ้ง
  hud.setThinking(false);
  if (!move) {
    inputLocked = false;
    return;
  }
  void applyAndAnimate(move);
};

function onGameOver(st: 'checkmate' | 'stalemate' | 'draw'): void {
  over = true;
  inputLocked = true;
  let msg: string;
  if (st === 'checkmate') {
    const w = winner(state);
    msg = `🏆 ${w ? colorTH(w) : ''} ชนะ! (รุกจน)`;
    sound.play('checkmate');
  } else {
    msg = st === 'stalemate' ? '🤝 อับ — เสมอ' : '🤝 เสมอ';
    sound.play('end');
  }
  updateHud();
  hud.showOverlay(msg);
}

function updateHud(): void {
  hud.setTurn(state.turn);
  const st = status(state);
  const txt =
    st === 'check' ? 'รุก!' : st === 'checkmate' ? 'รุกจน!' : st === 'stalemate' ? 'อับ (เสมอ)' : st === 'draw' ? 'เสมอ' : '';
  const kind = st === 'check' ? 'check' : st === 'checkmate' || st === 'stalemate' || st === 'draw' ? 'over' : 'normal';
  hud.setStatus(txt, kind);
  hud.setHistory(
    state.history.map((r, i) => ({
      n: i + 1,
      text: squareToCoord(r.move.from) + (r.captured ? '×' : '–') + squareToCoord(r.move.to) + (r.promoted ? '⁺' : ''),
      color: r.piece.color,
    }))
  );
}

function resetLocalGame(): void {
  state = createGame();
  selected = null;
  over = false;
  inputLocked = false;
  view.rebuildPieces(state.board);
  view.clearSelection();
  view.clearLastMove();
  hud.hideOverlay();
  hud.setThinking(false);
  updateHud();
}

function newGame(): void {
  aiReqId++; // ยกเลิกคำขอ AI ที่ค้าง
  if (mode === 'online') {
    // ออนไลน์: เฉพาะ host รีเซ็ตได้ แล้ว sync ให้คู่ต่อสู้
    if (online && online.role === 'host') {
      resetLocalGame();
      sound.play('start');
      sendWelcome();
      updateOnlineStatus();
    }
    return;
  }
  resetLocalGame();
  sound.play('start');
  if (mode === 'ai' && state.turn === aiSide) triggerAI();
}

// ===== ออนไลน์ =====
function updateOnlineStatus(): void {
  if (mode !== 'online') return;
  if (!online) {
    hud.setOnlineStatus(onlineAvailable() ? 'กด "สร้างห้อง" หรือใส่รหัสเพื่อเข้าร่วม' : 'ยังไม่ได้ตั้งค่า Supabase');
    return;
  }
  const me = myColor === 'white' ? 'ขาว' : 'ดำ';
  const opp = opponentPresent ? '✅ คู่ต่อสู้พร้อม' : '⏳ รอคู่ต่อสู้…';
  hud.setOnlineStatus(`ห้อง ${online.code} · คุณ=${me} · ${opp}`);
}

function sendWelcome(): void {
  if (!online || online.role !== 'host') return;
  online.send('welcome', { hostColor: myColor, moves: state.history.map((r) => encodeMove(r.move)) });
}

function applyWelcome(p: Record<string, unknown>): void {
  const hostColor = (p.hostColor as Color) ?? 'white';
  const nextColor = online && online.role === 'host' ? hostColor : opposite(hostColor);
  const moves = Array.isArray(p.moves) ? (p.moves as unknown[]) : [];

  // เล่นซ้ำลง state ชั่วคราวก่อน + validate ทุกตา — ถ้าตาใดเพี้ยน/ผิดกติกา ให้ยกเลิก
  // การซิงก์ทั้งหมด (ไม่เข้าสู่ state ที่พัง) แล้วขอซิงก์ใหม่จากโฮสต์
  let next = createGame();
  try {
    for (const enc of moves) {
      if (typeof enc !== 'string') throw new Error('รูปแบบตาเดินไม่ถูกต้อง');
      const mv = decodeMove(enc); // โยน error ถ้าพิกัดเพี้ยน (L4)
      const legal = validateMove(next, mv);
      if (!legal) throw new Error(`ตาเดินไม่ถูกกติกา: ${enc}`);
      next = applyMove(next, legal);
    }
  } catch (e) {
    console.warn('[online] welcome เสียหาย — ยกเลิกการซิงก์:', (e as Error).message);
    hud.setOnlineStatus('ข้อมูลเกมเพี้ยน — กำลังขอซิงก์ใหม่…');
    online?.send('hello', {});
    return;
  }

  myColor = nextColor;
  state = next;
  over = false;
  selected = null;
  inputLocked = false;
  view.rebuildPieces(state.board);
  view.clearSelection();
  const last = state.history[state.history.length - 1];
  if (last) view.showLastMove(last.move.from, last.move.to);
  else view.clearLastMove();
  hud.hideOverlay();
  updateHud();
  updateOnlineStatus();
}

function setupOnlineHandlers(): void {
  if (!online) return;
  online.onPresence = (present) => {
    opponentPresent = present;
    updateOnlineStatus();
    if (present && online && online.role === 'host') sendWelcome();
  };
  online.on('hello', () => {
    if (online && online.role === 'host') sendWelcome();
  });
  online.on('welcome', (p) => applyWelcome(p));
  online.on('move', (p) => void onRemoteMove(p.ply as number, p.enc as string));
}

async function createRoom(): Promise<void> {
  if (!onlineAvailable()) {
    hud.setOnlineStatus('ยังไม่ได้ตั้งค่า Supabase');
    return;
  }
  if (online) await online.leave();
  online = new OnlineSession();
  setupOnlineHandlers();
  myColor = 'white';
  hud.setOnlineStatus('กำลังสร้างห้อง…');
  try {
    await online.connect(genRoomCode(), 'host');
  } catch {
    hud.setOnlineStatus('เชื่อมต่อไม่สำเร็จ');
    online = null;
    return;
  }
  resetLocalGame();
  updateOnlineStatus();
}

async function joinRoom(code: string): Promise<void> {
  if (!onlineAvailable()) {
    hud.setOnlineStatus('ยังไม่ได้ตั้งค่า Supabase');
    return;
  }
  if (online) await online.leave();
  online = new OnlineSession();
  setupOnlineHandlers();
  hud.setOnlineStatus(`กำลังเข้าห้อง ${code}…`);
  try {
    await online.connect(code, 'guest');
  } catch {
    hud.setOnlineStatus('เข้าห้องไม่สำเร็จ');
    online = null;
    return;
  }
  online.send('hello', {});
}

function doUndo(): void {
  if (mode === 'online') return; // ออนไลน์ยังไม่รองรับการขอย้อน
  // กันการย้อนระหว่างอนิเมชันยังทำงาน (รวม pop ตอนสลับธีม/tween เลื่อนขั้น
  // ที่ไม่ได้ await) — ป้องกัน rebuild ทับ object ที่กำลังถูกอนิเมต
  if (inputLocked || view.busy || state.history.length === 0) return;
  aiReqId++; // ยกเลิกคำขอ AI ที่ค้าง
  state = undo(state);
  // ในโหมด AI ย้อนทั้งตา AI และตาเราให้กลับมาเป็นตาเรา
  if (mode === 'ai' && state.turn === aiSide && state.history.length > 0) state = undo(state);
  over = false;
  selected = null;
  inputLocked = false;
  view.rebuildPieces(state.board);
  view.clearSelection();
  const last = state.history[state.history.length - 1];
  if (last) view.showLastMove(last.move.from, last.move.to);
  else view.clearLastMove();
  hud.hideOverlay();
  updateHud();
}

// เริ่มต้น
updateHud();

// dev-only hook สำหรับทดสอบ/ดีบัก (ไม่ติดไปกับ production build)
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).makruk = {
    pick: onPick,
    view,
    sound,
    state: () => state,
    status: () => status(state),
    busy: () => inputLocked || view.busy,
    online: () => online,
    myColor: () => myColor,
    supabase: () => getSupabase(),
    onlineAvailable,
    applyModelTheme: async (models: Record<string, string>) => {
      const t = createAiModelTheme('demo', 'Demo 3D', models);
      await t.preload?.();
      themeWhite = t;
      themeBlack = t;
      view.setThemes(themeWhite, themeBlack, state.board);
      refreshHighlights();
      updateHud();
    },
  };
}
