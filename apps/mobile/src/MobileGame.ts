import {
  createGame,
  applyMove,
  undo,
  status,
  winner,
  legalMovesFrom,
  encodeMove,
  decodeMove,
  opposite,
  chooseMove,
  DIFFICULTIES,
  type Color,
  type GameState,
  type Move,
  type Square,
} from '@makruk/engine';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { MobileBoardView } from './three/MobileBoardView';
import { SoundManager } from './audio/sound';
import { getTheme, DEFAULT_THEME_ID } from './three/themes/registry';
import { OnlineSession, genRoomCode } from './online/online';
import { onlineAvailable } from './online/supabaseClient';

export type Mode = '2p' | 'ai' | 'online';
export type Diff = 'easy' | 'medium' | 'hard';

export interface UiState {
  ready: boolean;
  turn: Color;
  statusText: string;
  statusKind: 'normal' | 'check' | 'over';
  mode: Mode;
  difficulty: Diff;
  themeId: string;
  historyLen: number;
  onlineStatus: string;
  muted: boolean;
}

/** ตัวควบคุมเกมฝั่งมือถือ — รวม engine + 3D view + online (UI เป็นแค่ตัวแสดงผล) */
export class MobileGame {
  private view: MobileBoardView | null = null;
  private gs: GameState = createGame();
  private mode: Mode = '2p';
  private aiSide: Color = 'black';
  private difficulty: Diff = 'medium';
  private selected: Square | null = null;
  private inputLocked = false;
  private over = false;
  private online: OnlineSession | null = null;
  private myColor: Color = 'white';
  private opponentPresent = false;
  private themeId = DEFAULT_THEME_ID;
  private aiReq = 0;
  private sound = new SoundManager();

  constructor(private notify: (s: UiState) => void) {}

  toggleMute(): void {
    this.sound.setMuted(!this.sound.isMuted);
    this.sync();
  }

  attachGL(gl: ExpoWebGLRenderingContext, w: number, h: number): void {
    this.view = new MobileBoardView(gl, getTheme(this.themeId), this.gs.board, w, h);
    this.sync();
  }
  setLayout(w: number, h: number): void {
    this.view?.setLayout(w, h);
  }
  orbit(dx: number, dy: number): void {
    this.view?.orbit(dx, dy);
  }
  tap(x: number, y: number): void {
    const sq = this.view?.pick(x, y);
    if (sq !== null && sq !== undefined) this.onTap(sq);
  }

  private sync(): void {
    const g = this.gs;
    const st = status(g);
    let statusText = '';
    let statusKind: 'normal' | 'check' | 'over' = 'normal';
    if (st === 'check') {
      statusText = 'รุก!';
      statusKind = 'check';
    } else if (st === 'checkmate') {
      const w = winner(g);
      statusText = `${w === 'white' ? 'ขาว' : 'ดำ'} ชนะ! (รุกจน)`;
      statusKind = 'over';
    } else if (st === 'stalemate') {
      statusText = 'อับ (เสมอ)';
      statusKind = 'over';
    } else if (st === 'draw') {
      statusText = 'เสมอ';
      statusKind = 'over';
    }

    let onlineStatus = '';
    if (this.mode === 'online') {
      if (!this.online) onlineStatus = onlineAvailable() ? 'กด "สร้างห้อง" หรือใส่รหัสเพื่อเข้าร่วม' : 'ยังไม่ได้ตั้งค่า Supabase';
      else
        onlineStatus = `ห้อง ${this.online.code} · คุณ=${this.myColor === 'white' ? 'ขาว' : 'ดำ'} · ${
          this.opponentPresent ? '✅ พร้อม' : '⏳ รอคู่ต่อสู้…'
        }`;
    }

    this.notify({
      ready: !!this.view,
      turn: g.turn,
      statusText,
      statusKind,
      mode: this.mode,
      difficulty: this.difficulty,
      themeId: this.themeId,
      historyLen: g.history.length,
      onlineStatus,
      muted: this.sound.isMuted,
    });
  }

  private humanTurn(): boolean {
    if (this.mode === 'ai') return this.gs.turn !== this.aiSide;
    if (this.mode === 'online') return !!this.online && this.opponentPresent && this.gs.turn === this.myColor;
    return true;
  }

  private select(sq: Square): void {
    const v = this.view;
    if (!v) return;
    this.selected = sq;
    v.clearSelection();
    v.showSelected(sq);
    v.showTargets(legalMovesFrom(this.gs.board, sq).map((m) => ({ to: m.to, capture: !!this.gs.board[m.to] })));
    this.sound.play('select');
  }
  private deselect(): void {
    this.selected = null;
    this.view?.clearSelection();
  }

  onTap(sq: Square): void {
    if (this.inputLocked || this.over || !this.humanTurn()) return;
    const piece = this.gs.board[sq];
    if (this.selected === null) {
      if (piece && piece.color === this.gs.turn) this.select(sq);
      return;
    }
    if (sq === this.selected) {
      this.deselect();
      return;
    }
    const mv = legalMovesFrom(this.gs.board, this.selected).find((m) => m.to === sq);
    if (mv) {
      void this.humanMove(mv);
      return;
    }
    if (piece && piece.color === this.gs.turn) {
      this.select(sq);
      return;
    }
    this.deselect();
  }

  private async applyAndAnimate(move: Move): Promise<void> {
    const v = this.view;
    if (!v) return;
    const piece = this.gs.board[move.from]!;
    const captured = this.gs.board[move.to] ?? null;
    this.inputLocked = true;
    this.deselect();
    if (captured) this.sound.play('capture', piece.type);
    else this.sound.play('move', piece.type);
    this.gs = applyMove(this.gs, move);
    this.sync();
    await v.animateMove({
      move,
      movedType: piece.type,
      color: piece.color,
      isCapture: !!captured,
      promoted: !!move.promotion,
    });
    v.showLastMove(move.from, move.to);
    if (move.promotion) this.sound.play('promote');
    const st = status(this.gs);
    if (st === 'check') this.sound.play('check');
    if (st === 'checkmate' || st === 'stalemate' || st === 'draw') {
      if (st === 'checkmate') this.sound.play('checkmate');
      this.over = true;
      this.inputLocked = true;
      this.sync();
      return;
    }
    this.inputLocked = false;
    this.sync();
  }

  private async humanMove(move: Move): Promise<void> {
    if (this.mode === 'online' && this.online) this.online.send('move', { ply: this.gs.history.length, enc: encodeMove(move) });
    await this.applyAndAnimate(move);
    if (this.mode === 'ai' && !this.over && this.gs.turn === this.aiSide) this.triggerAI();
  }

  private triggerAI(): void {
    this.inputLocked = true;
    this.sync();
    const req = ++this.aiReq;
    const { depth, randomness } = DIFFICULTIES[this.difficulty];
    setTimeout(() => {
      if (req !== this.aiReq) return;
      const { move } = chooseMove(this.gs.board, this.gs.turn, depth, randomness);
      if (req !== this.aiReq) return;
      if (move) void this.applyAndAnimate(move);
      else {
        this.inputLocked = false;
        this.sync();
      }
    }, 120);
  }

  private async onRemoteMove(ply: number, enc: string): Promise<void> {
    if (this.mode !== 'online') return;
    if (ply !== this.gs.history.length) {
      this.online?.send('hello', {});
      return;
    }
    await this.applyAndAnimate(decodeMove(enc));
  }

  private resetLocalGame(): void {
    this.gs = createGame();
    this.selected = null;
    this.over = false;
    this.inputLocked = false;
    this.aiReq++;
    this.view?.rebuildPieces(this.gs.board);
    this.view?.clearSelection();
    this.view?.clearLastMove();
    this.sound.play('start');
    this.sync();
  }

  newGame(): void {
    if (this.mode === 'online') {
      if (this.online && this.online.role === 'host') {
        this.resetLocalGame();
        this.sendWelcome();
      }
      return;
    }
    this.resetLocalGame();
    if (this.mode === 'ai' && this.gs.turn === this.aiSide) this.triggerAI();
  }

  undoMove(): void {
    if (this.mode === 'online' || this.inputLocked || this.gs.history.length === 0) return;
    this.aiReq++;
    this.gs = undo(this.gs);
    if (this.mode === 'ai' && this.gs.turn === this.aiSide && this.gs.history.length > 0) this.gs = undo(this.gs);
    this.over = false;
    this.selected = null;
    this.view?.rebuildPieces(this.gs.board);
    this.view?.clearSelection();
    const last = this.gs.history[this.gs.history.length - 1];
    if (last) this.view?.showLastMove(last.move.from, last.move.to);
    else this.view?.clearLastMove();
    this.sync();
  }

  setMode(m: Mode): void {
    if (this.mode === 'online' && m !== 'online' && this.online) {
      void this.online.leave();
      this.online = null;
      this.opponentPresent = false;
    }
    this.mode = m;
    if (m === 'online') this.sync();
    else this.newGame();
  }

  setDifficulty(d: Diff): void {
    this.difficulty = d;
    this.sync();
  }

  setTheme(id: string): void {
    this.themeId = id;
    this.view?.setTheme(getTheme(id), this.gs.board);
    const last = this.gs.history[this.gs.history.length - 1];
    if (last) this.view?.showLastMove(last.move.from, last.move.to);
    this.sync();
  }

  // ===== online =====
  private sendWelcome(): void {
    if (!this.online || this.online.role !== 'host') return;
    this.online.send('welcome', { hostColor: this.myColor, moves: this.gs.history.map((r) => encodeMove(r.move)) });
  }

  private applyWelcome(p: Record<string, unknown>): void {
    const hostColor = (p.hostColor as Color) ?? 'white';
    this.myColor = this.online && this.online.role === 'host' ? hostColor : opposite(hostColor);
    const moves = (p.moves as string[]) ?? [];
    this.gs = createGame();
    for (const enc of moves) this.gs = applyMove(this.gs, decodeMove(enc));
    this.over = false;
    this.selected = null;
    this.inputLocked = false;
    this.view?.rebuildPieces(this.gs.board);
    this.view?.clearSelection();
    const last = this.gs.history[this.gs.history.length - 1];
    if (last) this.view?.showLastMove(last.move.from, last.move.to);
    else this.view?.clearLastMove();
    this.sync();
  }

  private setupOnlineHandlers(): void {
    if (!this.online) return;
    this.online.onPresence = (present) => {
      this.opponentPresent = present;
      if (present && this.online && this.online.role === 'host') this.sendWelcome();
      this.sync();
    };
    this.online.on('hello', () => {
      if (this.online && this.online.role === 'host') this.sendWelcome();
    });
    this.online.on('welcome', (p) => this.applyWelcome(p));
    this.online.on('move', (p) => void this.onRemoteMove(p.ply as number, p.enc as string));
  }

  async createRoom(): Promise<void> {
    if (!onlineAvailable()) {
      this.sync();
      return;
    }
    if (this.online) await this.online.leave();
    this.online = new OnlineSession();
    this.setupOnlineHandlers();
    this.myColor = 'white';
    try {
      await this.online.connect(genRoomCode(), 'host');
    } catch {
      this.online = null;
      this.sync();
      return;
    }
    this.resetLocalGame();
  }

  async joinRoom(code: string): Promise<void> {
    if (!onlineAvailable() || !code) {
      this.sync();
      return;
    }
    if (this.online) await this.online.leave();
    this.online = new OnlineSession();
    this.setupOnlineHandlers();
    try {
      await this.online.connect(code.toUpperCase(), 'guest');
    } catch {
      this.online = null;
      this.sync();
      return;
    }
    this.online.send('hello', {});
    this.sync();
  }
}
