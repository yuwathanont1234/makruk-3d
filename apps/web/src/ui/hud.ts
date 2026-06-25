import type { PieceType } from '@makruk/engine';

export type Mode = '2p' | 'ai' | 'online';
export type Diff = 'easy' | 'medium' | 'hard';
export type Side = 'white' | 'black';

export interface HudCallbacks {
  onMode(m: Mode): void;
  onDifficulty(d: Diff): void;
  onAiSide(s: Side): void;
  onTheme(id: string): void;
  onSound(id: string): void;
  onMute(m: boolean): void;
  onVolume(v: number): void;
  onNewGame(): void;
  onUndo(): void;
  onCreateRoom(): void;
  onJoinRoom(code: string): void;
  onAiTheme(): void;
  onBlackTheme(id: string): void;
  // v2
  onFlip(): void;
  onHint(): void;
  /** เริ่มเล่นจากหน้า landing — m บอกโหมดที่เลือก ('2p' = เล่นเลย) */
  onQuickStart(m: Mode): void;
}

export interface HudInit {
  mode: Mode;
  difficulty: Diff;
  aiSide: Side;
  themeId: string;
  blackThemeId: string;
  soundId: string;
  muted: boolean;
  volume: number;
}

export interface HudOptions {
  themes: { id: string; name: string; emoji: string }[];
  packs: { id: string; name: string }[];
  cb: HudCallbacks;
  initial: HudInit;
}

/** ข้อมูลแสดงบนแถบผู้เล่นแต่ละฝั่ง */
export interface PlayerInfo {
  /** อิโมจิ avatar */
  avatar: string;
  /** ชื่อแสดงผล เช่น "คุณ" / "AI ระดับกลาง" */
  name: string;
  /** ป้ายฝ่าย เช่น "ฝ่ายขาว" */
  label: string;
}

export type StatusKind = 'normal' | 'check' | 'over' | 'thinking';

type Attrs = Record<string, unknown>;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'text') e.textContent = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else e.setAttribute(k, String(v));
  }
  for (const kid of kids) e.append(kid);
  return e;
}

const DIFF_LABEL: Record<Diff, string> = { easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก' };

/** อิโมจิแทนหมากที่ถูกกิน (ใช้ใน captured tray + legend) */
const PIECE_EMOJI: Record<PieceType, string> = {
  khun: '👑',
  met: '🗡️',
  khon: '🐘',
  ma: '🐎',
  rua: '🏰',
  bia: '🪖',
};
/** legend ตำนานหมาก (ตาม mockup) */
const LEGEND: { icon: string; name: string; role: string }[] = [
  { icon: '👑', name: 'ขุน', role: 'เดิน 1 ช่อง รอบทิศ' },
  { icon: '🗡️', name: 'เม็ด', role: 'เดินทแยง 1 ช่อง' },
  { icon: '🐘', name: 'โคน', role: 'ทแยง 1 + ตรงหน้า 1' },
  { icon: '🐎', name: 'ม้า', role: 'รูปตัว L' },
  { icon: '🏰', name: 'เรือ', role: 'เดินตรงไม่จำกัด' },
  { icon: '🪖', name: 'เบี้ย', role: 'เดินหน้า ตีเฉียง' },
  { icon: '⭐', name: 'เบี้ยหงาย', role: 'ข้ามแดน = เม็ด' },
];

export class Hud {
  // top bar
  private brandChip: HTMLElement;
  // player bars
  private barTop: HTMLElement;
  private barBottom: HTMLElement;
  private avatarTop: HTMLElement;
  private avatarBottom: HTMLElement;
  private nameTop: HTMLElement;
  private nameBottom: HTMLElement;
  private labelTop: HTMLElement;
  private labelBottom: HTMLElement;
  private badgeTop: HTMLElement;
  private badgeBottom: HTMLElement;
  private capturedTop: HTMLElement;
  private capturedBottom: HTMLElement;
  private turnDotTop: HTMLElement;
  private turnDotBottom: HTMLElement;
  // status pill
  private statusPill: HTMLElement;
  // move history
  private moveStrip: HTMLElement;
  private historyTable: HTMLElement;
  // action bar
  private flipBtn: HTMLButtonElement;
  private undoBtn: HTMLButtonElement;
  private hintBtn: HTMLButtonElement;
  // sheets
  private backdrop: HTMLElement;
  private settingsSheet: HTMLElement;
  private legendSheet: HTMLElement;
  private historySheet: HTMLElement;
  // settings controls
  private modeBtns: HTMLButtonElement[] = [];
  private aiSubGroup!: HTMLElement;
  private onlineSubGroup!: HTMLElement;
  private diffBtns: HTMLButtonElement[] = [];
  private aiSideBtns: HTMLButtonElement[] = [];
  private onlineStatusEl!: HTMLElement;
  private themeSel!: HTMLSelectElement;
  private blackSel!: HTMLSelectElement;
  private soundSel!: HTMLSelectElement;
  private muteBtn!: HTMLButtonElement;
  // overlays
  private gameover: HTMLElement;
  private gameoverEmoji: HTMLElement;
  private gameoverMsg: HTMLElement;
  private gameoverSub: HTMLElement;
  private quickstart: HTMLElement;
  // state
  private thinking = false;
  private currentMode: Mode;

  constructor(root: HTMLElement, opts: HudOptions) {
    const cb = opts.cb;
    const init = opts.initial;
    this.currentMode = init.mode;

    // ---------- TOP BAR ----------
    this.brandChip = el('div', { class: 'brand-chip' }, '♟️ หมากรุกไทย 3D');
    const helpBtn = el('button', { class: 'icon-btn', title: 'ตำนานหมาก', 'aria-label': 'ตำนานหมาก', onclick: () => this.openSheet(this.legendSheet) }, '?');
    const gearBtn = el('button', { class: 'icon-btn', title: 'ตั้งค่า', 'aria-label': 'ตั้งค่า', onclick: () => this.openSheet(this.settingsSheet) }, '⚙');
    const topbar = el('div', { class: 'topbar' }, this.brandChip, el('div', { class: 'topbar-actions' }, helpBtn, gearBtn));

    // ---------- PLAYER BARS ----------
    this.avatarTop = el('div', { class: 'player-avatar' }, '🤖');
    this.turnDotTop = el('span', { class: 'turn-badge black' });
    this.nameTop = el('div', { class: 'player-name' }, this.turnDotTop, document.createTextNode('ผู้เล่น 2'));
    this.labelTop = el('div', { class: 'player-label', text: 'ฝ่ายดำ' });
    this.badgeTop = el('span', { class: 'player-badge' });
    this.capturedTop = el('div', { class: 'captured-tray' });
    this.barTop = el(
      'div',
      { class: 'player-bar player-bar-top' },
      this.avatarTop,
      el('div', { class: 'player-info' }, this.nameTop, this.labelTop),
      this.capturedTop,
      this.badgeTop
    );

    this.avatarBottom = el('div', { class: 'player-avatar' }, '👤');
    this.turnDotBottom = el('span', { class: 'turn-badge white' });
    this.nameBottom = el('div', { class: 'player-name' }, this.turnDotBottom, document.createTextNode('ผู้เล่น 1'));
    this.labelBottom = el('div', { class: 'player-label', text: 'ฝ่ายขาว' });
    this.badgeBottom = el('span', { class: 'player-badge' });
    this.capturedBottom = el('div', { class: 'captured-tray' });
    this.barBottom = el(
      'div',
      { class: 'player-bar player-bar-bottom' },
      this.avatarBottom,
      el('div', { class: 'player-info' }, this.nameBottom, this.labelBottom),
      this.capturedBottom,
      this.badgeBottom
    );

    // ---------- MOVE HISTORY STRIP ----------
    this.moveStrip = el('div', { class: 'move-history-strip empty', title: 'ประวัติการเดิน', onclick: () => this.openSheet(this.historySheet) });

    // ---------- STATUS PILL ----------
    this.statusPill = el('div', { class: 'status-pill' });
    const statusArea = el('div', { class: 'status-area' }, this.statusPill);

    // ---------- ACTION BAR ----------
    this.flipBtn = el('button', { class: 'icon-action flip-btn', title: 'กลับกระดาน', 'aria-label': 'กลับกระดาน', onclick: () => cb.onFlip() }, '⇅') as HTMLButtonElement;
    this.undoBtn = el('button', { class: 'btn btn-secondary', style: 'min-width:84px', onclick: () => cb.onUndo() }, '↩️ ย้อน') as HTMLButtonElement;
    const newBtn = el('button', { class: 'btn btn-primary', onclick: () => cb.onNewGame() }, '♻️ เกมใหม่');
    this.hintBtn = el('button', { class: 'icon-action hint-btn', title: 'คำแนะนำ', 'aria-label': 'คำแนะนำ', onclick: () => cb.onHint() }, '💡') as HTMLButtonElement;
    const actionBar = el('div', { class: 'action-bar' }, this.flipBtn, this.undoBtn, newBtn, this.hintBtn);

    // ---------- SHEETS BACKDROP ----------
    this.backdrop = el('div', { class: 'sheet-backdrop', onclick: () => this.closeSheets() });

    // ---------- SETTINGS SHEET ----------
    this.settingsSheet = this.buildSettingsSheet(opts);

    // ---------- LEGEND SHEET ----------
    this.legendSheet = this.buildLegendSheet();

    // ---------- HISTORY SHEET ----------
    this.historyTable = el('div', { class: 'history-table' });
    this.historySheet = el(
      'div',
      { class: 'sheet history-sheet', role: 'dialog', 'aria-label': 'ประวัติการเดิน' },
      el('div', { class: 'drag-handle' }),
      el('div', { class: 'sheet-header' }, el('span', { class: 'sheet-title' }, 'ประวัติการเดิน'), el('button', { class: 'sheet-close', 'aria-label': 'ปิด', onclick: () => this.closeSheets() }, '✕')),
      el('div', { class: 'sheet-divider' }),
      this.historyTable
    );

    // ---------- GAME OVER ----------
    this.gameoverEmoji = el('div', { class: 'gameover-emoji' }, '🏆');
    this.gameoverMsg = el('div', { class: 'gameover-msg' });
    this.gameoverSub = el('div', { class: 'gameover-sub' });
    const gameoverBtn = el('button', { class: 'btn btn-primary', onclick: () => cb.onNewGame() }, 'เล่นใหม่');
    this.gameover = el(
      'div',
      { class: 'gameover-overlay hidden' },
      el('div', { class: 'gameover-card' }, this.gameoverEmoji, this.gameoverMsg, this.gameoverSub, gameoverBtn)
    );

    // ---------- QUICK START ----------
    this.quickstart = this.buildQuickStart(cb);

    // mount
    root.append(topbar, this.barTop, this.moveStrip, statusArea, this.barBottom, actionBar, this.backdrop, this.settingsSheet, this.legendSheet, this.historySheet, this.gameover, this.quickstart);

    // swipe-down to close sheets
    this.wireSwipeDown([this.settingsSheet, this.legendSheet, this.historySheet]);

    this.setMuted(init.muted);
    this.setMode(init.mode);
    this.setAiSide(init.aiSide);
    this.setDifficulty(init.difficulty);
  }

  // ============================================================
  // builders
  // ============================================================
  private buildSettingsSheet(opts: HudOptions): HTMLElement {
    const cb = opts.cb;
    const init = opts.initial;

    // mode segmented
    const mk = (m: Mode, label: string): HTMLButtonElement =>
      el('button', { class: 'seg-btn', 'data-mode': m, onclick: () => cb.onMode(m) }, label) as HTMLButtonElement;
    const mk2p = mk('2p', '🧑‍🤝‍🧑 2 คน');
    const mkAi = mk('ai', '🤖 vs AI');
    const mkOnline = mk('online', '🌐 ออนไลน์');
    this.modeBtns = [mk2p, mkAi, mkOnline];
    const modeSeg = el('div', { class: 'seg-control' }, mk2p, mkAi, mkOnline);

    // ai sub: difficulty + side
    const diffBtn = (d: Diff): HTMLButtonElement => el('button', { class: 'seg-btn-sm', onclick: () => cb.onDifficulty(d) }, DIFF_LABEL[d]) as HTMLButtonElement;
    this.diffBtns = (['easy', 'medium', 'hard'] as Diff[]).map(diffBtn);
    const sideW = el('button', { class: 'seg-btn-sm', onclick: () => cb.onAiSide('white') }, 'ขาว') as HTMLButtonElement;
    const sideB = el('button', { class: 'seg-btn-sm', onclick: () => cb.onAiSide('black') }, 'ดำ') as HTMLButtonElement;
    this.aiSideBtns = [sideW, sideB];
    this.aiSubGroup = el(
      'div',
      { class: 'sub-group' },
      el('div', {}, el('div', { class: 'sub-label' }, 'ระดับ AI'), el('div', { class: 'seg-control-sm' }, ...this.diffBtns)),
      el('div', {}, el('div', { class: 'sub-label' }, 'เลือกฝ่าย (AI เล่นฝ่ายไหน)'), el('div', { class: 'seg-control-sm' }, sideW, sideB))
    );

    // online sub
    const createBtn = el('button', { class: 'btn btn-secondary', style: 'flex:1', onclick: () => cb.onCreateRoom() }, '🆕 สร้างห้อง');
    const codeInput = el('input', { class: 'code-input', placeholder: 'รหัส', maxlength: '4', autocapitalize: 'characters' }) as HTMLInputElement;
    const joinBtn = el('button', { class: 'btn btn-secondary', onclick: () => { const v = codeInput.value.trim().toUpperCase(); if (v) cb.onJoinRoom(v); } }, 'เข้าร่วม');
    this.onlineStatusEl = el('div', { class: 'online-status' });
    this.onlineSubGroup = el('div', { class: 'sub-group' }, el('div', { class: 'online-row' }, createBtn, codeInput, joinBtn), this.onlineStatusEl);

    const modeSection = el('div', { class: 'section' }, el('div', { class: 'section-label' }, 'โหมดเกม'), modeSeg, this.aiSubGroup, this.onlineSubGroup);

    // theme section
    const themeSel = el('select', { class: 'select-field', style: 'flex:1', onchange: (e: Event) => cb.onTheme((e.target as HTMLSelectElement).value) }) as HTMLSelectElement;
    opts.themes.forEach((t) => themeSel.append(el('option', { value: t.id }, `${t.emoji} ${t.name}`)));
    themeSel.value = init.themeId;
    this.themeSel = themeSel;
    const aiThemeBtn = el('button', { class: 'ai-theme-btn', title: 'ให้ AI สร้างชุดหมากจากคำของคุณ', 'aria-label': 'AI สร้างธีม', onclick: () => cb.onAiTheme() }, '✨');
    const blackSel = el('select', { class: 'select-field', style: 'flex:1', onchange: (e: Event) => cb.onBlackTheme((e.target as HTMLSelectElement).value) }) as HTMLSelectElement;
    opts.themes.forEach((t) => blackSel.append(el('option', { value: t.id }, `${t.emoji} ${t.name}`)));
    blackSel.value = init.blackThemeId;
    this.blackSel = blackSel;
    const themeSection = el(
      'div',
      { class: 'section' },
      el('div', { class: 'section-label' }, 'ธีมหมาก'),
      el('div', { class: 'select-row' }, el('span', { class: 'select-label', html: '<span class="badge-dot w"></span>ฝ่ายขาว/กระดาน' }), el('div', { style: 'display:flex;gap:6px;flex:1' }, themeSel, aiThemeBtn)),
      el('div', { class: 'select-row' }, el('span', { class: 'select-label', html: '<span class="badge-dot b"></span>ฝ่ายดำ' }), blackSel)
    );

    // sound section
    const soundSel = el('select', { class: 'select-field', style: 'flex:1', onchange: (e: Event) => cb.onSound((e.target as HTMLSelectElement).value) }) as HTMLSelectElement;
    opts.packs.forEach((p) => soundSel.append(el('option', { value: p.id }, p.name)));
    soundSel.value = init.soundId;
    this.soundSel = soundSel;
    this.muteBtn = el('button', { class: 'mute-btn', 'aria-label': 'ปิดเสียง', onclick: () => cb.onMute(!this.muteBtn.classList.contains('muted')) }, '🔊') as HTMLButtonElement;
    const vol = el('input', { class: 'volume-slider', type: 'range', min: '0', max: '1', step: '0.05', value: String(init.volume), 'aria-label': 'ระดับเสียง', oninput: (e: Event) => cb.onVolume(parseFloat((e.target as HTMLInputElement).value)) });
    const soundSection = el(
      'div',
      { class: 'section' },
      el('div', { class: 'section-label' }, 'เสียง'),
      el('div', { class: 'select-row' }, el('span', { class: 'select-label' }, 'ชุดเสียง'), soundSel),
      el('div', { class: 'sound-row' }, this.muteBtn, vol)
    );

    const body = el('div', { class: 'sheet-body' }, modeSection, themeSection, soundSection);
    const action = el('div', { class: 'sheet-action' }, el('button', { class: 'btn btn-primary', onclick: () => { cb.onNewGame(); this.closeSheets(); } }, '♻️ เริ่มเกมใหม่'));

    return el(
      'div',
      { class: 'sheet settings-sheet', role: 'dialog', 'aria-label': 'การตั้งค่า' },
      el('div', { class: 'drag-handle' }),
      el('div', { class: 'sheet-header' }, el('span', { class: 'sheet-title' }, 'การตั้งค่า'), el('button', { class: 'sheet-close', 'aria-label': 'ปิด', onclick: () => this.closeSheets() }, '✕')),
      el('div', { class: 'sheet-divider' }),
      body,
      action
    );
  }

  private buildLegendSheet(): HTMLElement {
    const grid = el(
      'div',
      { class: 'piece-grid' },
      ...LEGEND.map((p) => el('div', { class: 'piece-card' }, el('div', { class: 'piece-icon' }, p.icon), el('div', { class: 'piece-name' }, p.name), el('div', { class: 'piece-role' }, p.role)))
    );
    return el(
      'div',
      { class: 'sheet legend-sheet', role: 'dialog', 'aria-label': 'ตำนานหมาก' },
      el('div', { class: 'drag-handle' }),
      el('div', { class: 'sheet-header' }, el('span', { class: 'sheet-title' }, 'ตำนานหมาก'), el('button', { class: 'sheet-close', 'aria-label': 'ปิด', onclick: () => this.closeSheets() }, '✕')),
      el('div', { class: 'sheet-divider' }),
      el('div', { class: 'sheet-body', style: 'padding-left:0;padding-right:0' }, grid)
    );
  }

  private buildQuickStart(cb: HudCallbacks): HTMLElement {
    const playBtn = el('button', { class: 'qs-play-btn', onclick: () => cb.onQuickStart('2p') }, '▶ เล่นเลย');
    const secBtn = (icon: string, label: string, m: Mode): HTMLElement =>
      el('button', { class: 'qs-secondary-btn', onclick: () => cb.onQuickStart(m) }, el('span', { class: 'qs-icon' }, icon), el('span', { class: 'qs-label' }, label));
    return el(
      'div',
      { class: 'quickstart-overlay' },
      el('div', { class: 'qs-logo' }, '♟️'),
      el('div', { class: 'qs-title' }, 'หมากรุกไทย 3D'),
      el('div', { class: 'qs-subtitle' }, 'เลือกโหมดแล้วเริ่มเลย'),
      playBtn,
      el('div', { class: 'qs-secondary-row' }, secBtn('🤖', 'vs AI', 'ai'), secBtn('🌐', 'ออนไลน์', 'online'), secBtn('⚙', 'ตั้งค่า', '2p'))
    );
  }

  // ============================================================
  // sheet helpers
  // ============================================================
  private openSheet(sheet: HTMLElement): void {
    this.closeSheets();
    sheet.classList.add('open');
    this.backdrop.classList.add('visible');
  }
  private closeSheets(): void {
    this.settingsSheet.classList.remove('open');
    this.legendSheet.classList.remove('open');
    this.historySheet.classList.remove('open');
    this.backdrop.classList.remove('visible');
  }
  /** เปิด settings sheet พร้อมเลือกโหมดไว้ล่วงหน้า (ใช้จาก quick-start) */
  openSettings(): void {
    this.openSheet(this.settingsSheet);
  }

  private wireSwipeDown(sheets: HTMLElement[]): void {
    let startY = 0;
    for (const s of sheets) {
      s.addEventListener('touchstart', (e: TouchEvent) => { startY = e.touches[0].clientY; }, { passive: true });
      s.addEventListener('touchend', (e: TouchEvent) => { if (e.changedTouches[0].clientY - startY > 60) this.closeSheets(); }, { passive: true });
    }
  }

  // ============================================================
  // public API
  // ============================================================
  /** ตั้งข้อมูลผู้เล่นทั้งสองฝั่ง (top = ฝ่ายดำ, bottom = ฝ่ายขาว เสมอ) */
  setPlayers(white: PlayerInfo, black: PlayerInfo): void {
    this.avatarBottom.textContent = white.avatar;
    this.nameBottom.replaceChildren(this.turnDotBottom, document.createTextNode(white.name));
    this.labelBottom.textContent = white.label;
    this.avatarTop.textContent = black.avatar;
    this.nameTop.replaceChildren(this.turnDotTop, document.createTextNode(black.name));
    this.labelTop.textContent = black.label;
  }

  /** ไฮไลต์แถบฝ่ายที่ถึงตา (แทน turn pill เดิม) */
  setTurn(color: Side): void {
    this.barBottom.classList.toggle('active-turn', color === 'white');
    this.barTop.classList.toggle('active-turn', color === 'black');
  }

  /** สถานะเกม (รุก/รุกจน/เสมอ/คิด) — แสดงเป็น badge บนแถบฝ่ายที่ถึงตา + status pill */
  setStatus(text: string, kind: StatusKind = 'normal', activeSide: Side = 'white'): void {
    if (this.thinking && kind !== 'thinking') return;
    // badge บนแถบผู้เล่น
    const showBadge = kind === 'check' || kind === 'over';
    const activeBadge = activeSide === 'white' ? this.badgeBottom : this.badgeTop;
    const otherBadge = activeSide === 'white' ? this.badgeTop : this.badgeBottom;
    otherBadge.className = 'player-badge';
    otherBadge.textContent = '';
    if (showBadge) {
      activeBadge.className = `player-badge show ${kind === 'over' ? 'over' : 'check'}`;
      activeBadge.textContent = text;
    } else {
      activeBadge.className = 'player-badge';
      activeBadge.textContent = '';
    }
    // status pill (กลางบน)
    if (text && kind !== 'normal') {
      this.statusPill.className = `status-pill show ${kind === 'over' ? 'over' : kind === 'thinking' ? 'thinking' : ''}`;
      this.statusPill.textContent = text;
    } else {
      this.statusPill.className = 'status-pill';
      this.statusPill.textContent = '';
    }
  }

  /**
   * แสดงข้อความระบบชั่วคราว (โหลดธีม/สร้างธีม AI/ข้อผิดพลาดออนไลน์) บน status pill
   * เป็นข้อมูลคนละชนิดกับ setStatus (เกม) — ส่งสตริงว่างเพื่อล้าง
   */
  setNotice(text: string): void {
    if (text) {
      this.statusPill.className = 'status-pill show thinking';
      this.statusPill.textContent = text;
    } else if (!this.thinking) {
      this.statusPill.className = 'status-pill';
      this.statusPill.textContent = '';
    }
  }

  setThinking(b: boolean): void {
    this.thinking = b;
    if (b) {
      this.statusPill.className = 'status-pill show thinking';
      this.statusPill.textContent = '🤖 AI กำลังคิด…';
    } else {
      this.statusPill.className = 'status-pill';
      this.statusPill.textContent = '';
    }
  }

  /** อัปเดต captured tray ของฝ่ายหนึ่ง (white = bottom, black = top) พร้อม material delta */
  setCaptured(side: Side, captured: PieceType[], delta: number): void {
    const tray = side === 'white' ? this.capturedBottom : this.capturedTop;
    const pieces = captured.map((t) => el('span', { class: 'captured-piece' }, PIECE_EMOJI[t]));
    const nodes: (Node | string)[] = [...pieces];
    if (delta > 0) nodes.push(el('span', { class: 'material-delta' }, `+${delta}`));
    tray.replaceChildren(...nodes);
  }

  /** ป้อนประวัติทั้งหมด: strip (ล่าสุดท้าย) + full sheet table */
  setMoveHistory(moves: { white: string; black: string | null }[]): void {
    // strip
    this.moveStrip.classList.toggle('empty', moves.length === 0);
    const entries: HTMLElement[] = [];
    moves.forEach((m, i) => {
      entries.push(el('span', { class: 'move-entry' }, el('span', { class: 'move-num' }, `${i + 1}.`), document.createTextNode(' ' + m.white)));
      if (m.black) entries.push(el('span', { class: 'move-entry' }, document.createTextNode(m.black)));
    });
    // ทำให้ entry สุดท้ายเป็น latest
    if (entries.length > 0) entries[entries.length - 1].classList.add('latest');
    entries.push(el('span', { class: 'move-history-expand' }, '▸'));
    this.moveStrip.replaceChildren(...entries);
    // scroll ไปขวาสุดให้เห็นตาเดินล่าสุด
    this.moveStrip.scrollLeft = this.moveStrip.scrollWidth;

    // full table
    if (moves.length === 0) {
      this.historyTable.replaceChildren(el('div', { class: 'history-empty' }, 'ยังไม่มีตาเดิน'));
      return;
    }
    const rows = moves.map((m, i) =>
      el(
        'div',
        { class: 'history-row' + (i === moves.length - 1 ? ' current-row' : '') },
        el('span', { class: 'h-num' }, String(i + 1)),
        el('span', { class: 'h-white' }, m.white),
        el('span', { class: 'h-black' }, m.black ?? '—')
      )
    );
    this.historyTable.replaceChildren(...rows);
  }

  setMode(m: Mode): void {
    this.currentMode = m;
    this.modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
    this.aiSubGroup.style.display = m === 'ai' ? '' : 'none';
    this.onlineSubGroup.style.display = m === 'online' ? '' : 'none';
  }

  setOnlineStatus(text: string): void {
    this.onlineStatusEl.textContent = text;
  }

  setAiSide(s: Side): void {
    this.aiSideBtns[0].classList.toggle('active', s === 'white');
    this.aiSideBtns[1].classList.toggle('active', s === 'black');
  }

  setDifficulty(d: Diff): void {
    const order: Diff[] = ['easy', 'medium', 'hard'];
    this.diffBtns.forEach((b, i) => b.classList.toggle('active', order[i] === d));
  }

  setTheme(id: string): void {
    this.themeSel.value = id;
  }
  setBlackTheme(id: string): void {
    this.blackSel.value = id;
  }
  setSound(id: string): void {
    this.soundSel.value = id;
  }
  setMuted(b: boolean): void {
    this.muteBtn.classList.toggle('muted', b);
    this.muteBtn.textContent = b ? '🔇' : '🔊';
  }

  setFlipped(b: boolean): void {
    this.flipBtn.classList.toggle('flipped', b);
  }
  setHintEnabled(b: boolean): void {
    this.hintBtn.disabled = !b;
  }
  setUndoEnabled(b: boolean): void {
    this.undoBtn.disabled = !b;
  }

  // game over
  showOverlay(msg: string, sub = '', emoji = '🏆'): void {
    this.gameoverEmoji.textContent = emoji;
    this.gameoverMsg.textContent = msg;
    this.gameoverSub.textContent = sub;
    this.gameover.classList.remove('hidden');
  }
  hideOverlay(): void {
    this.gameover.classList.add('hidden');
  }

  // quick-start
  showQuickStart(): void {
    this.quickstart.classList.remove('hidden');
  }
  hideQuickStart(): void {
    this.quickstart.classList.add('hidden');
  }

  /** ปิด sheets ทั้งหมด (เรียกจากภายนอกได้ เช่น เมื่อเริ่มเกม) */
  dismissSheets(): void {
    this.closeSheets();
  }
}
