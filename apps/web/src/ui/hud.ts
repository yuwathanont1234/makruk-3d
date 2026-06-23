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

type Attrs = Record<string, unknown>;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'text') e.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else e.setAttribute(k, String(v));
  }
  for (const kid of kids) e.append(kid);
  return e;
}

const DIFF_LABEL: Record<Diff, string> = { easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก' };

export class Hud {
  private turnBadge: HTMLElement;
  private turnText: HTMLElement;
  private statusEl: HTMLElement;
  private modeBtns: HTMLButtonElement[] = [];
  private diffWrap: HTMLElement;
  private aiSideWrap: HTMLElement;
  private aiSideBtns: HTMLButtonElement[] = [];
  private onlineWrap: HTMLElement;
  private onlineStatusEl: HTMLElement;
  private muteBtn: HTMLButtonElement;
  private historyOl: HTMLElement;
  private overlay: HTMLElement;
  private overlayMsg: HTMLElement;
  private thinking = false;

  constructor(root: HTMLElement, opts: HudOptions) {
    const cb = opts.cb;
    const init = opts.initial;

    // --- top bar ---
    this.turnBadge = el('span', { class: `badge ${init.aiSide}` });
    this.turnText = el('span', { class: 'turn-text', text: 'ตาขาว' });
    this.statusEl = el('span', { class: 'status' });
    const topbar = el(
      'div',
      { class: 'topbar' },
      el('div', { class: 'brand' }, '♟️ หมากรุกไทย 3D'),
      el('div', { class: 'statusline' }, el('span', { class: 'turn' }, this.turnBadge, this.turnText), this.statusEl)
    );

    // --- mode segmented ---
    const mk2p = el('button', { class: 'segbtn', 'data-mode': '2p', onclick: () => cb.onMode('2p') }, '🧑‍🤝‍🧑 2 คน') as HTMLButtonElement;
    const mkAi = el('button', { class: 'segbtn', 'data-mode': 'ai', onclick: () => cb.onMode('ai') }, '🤖 vs AI') as HTMLButtonElement;
    const mkOnline = el('button', { class: 'segbtn', 'data-mode': 'online', onclick: () => cb.onMode('online') }, '🌐 ออนไลน์') as HTMLButtonElement;
    this.modeBtns = [mk2p, mkAi, mkOnline];
    const modeSeg = el('div', { class: 'seg' }, mk2p, mkAi, mkOnline);

    // --- difficulty ---
    const diffSel = el('select', { class: 'select', onchange: (e: Event) => cb.onDifficulty((e.target as HTMLSelectElement).value as Diff) }) as HTMLSelectElement;
    (['easy', 'medium', 'hard'] as Diff[]).forEach((d) => diffSel.append(el('option', { value: d }, DIFF_LABEL[d])));
    diffSel.value = init.difficulty;
    this.diffWrap = el('label', { class: 'group' }, el('span', { class: 'lbl' }, 'ระดับ'), diffSel);

    // --- AI side ---
    const sideW = el('button', { class: 'segbtn', onclick: () => cb.onAiSide('white') }, 'ขาว') as HTMLButtonElement;
    const sideB = el('button', { class: 'segbtn', onclick: () => cb.onAiSide('black') }, 'ดำ') as HTMLButtonElement;
    this.aiSideBtns = [sideW, sideB];
    this.aiSideWrap = el('label', { class: 'group' }, el('span', { class: 'lbl' }, 'AI ฝ่าย'), el('div', { class: 'seg' }, sideW, sideB));

    // --- online room ---
    const createBtn = el('button', { class: 'btn', onclick: () => cb.onCreateRoom() }, '🆕 สร้างห้อง');
    const codeInput = el('input', {
      class: 'code-input',
      placeholder: 'รหัส',
      maxlength: '4',
      autocapitalize: 'characters',
    }) as HTMLInputElement;
    const joinBtn = el(
      'button',
      {
        class: 'btn',
        onclick: () => {
          const v = codeInput.value.trim().toUpperCase();
          if (v) cb.onJoinRoom(v);
        },
      },
      'เข้าร่วม'
    );
    this.onlineStatusEl = el('span', { class: 'online-status' });
    this.onlineWrap = el('div', { class: 'group online' }, createBtn, codeInput, joinBtn, this.onlineStatusEl);

    // --- theme ---
    const themeSel = el('select', { class: 'select', onchange: (e: Event) => cb.onTheme((e.target as HTMLSelectElement).value) }) as HTMLSelectElement;
    opts.themes.forEach((t) => themeSel.append(el('option', { value: t.id }, `${t.emoji} ${t.name}`)));
    themeSel.value = init.themeId;
    const aiThemeBtn = el('button', { class: 'btn', title: 'ให้ AI สร้างชุดหมากจากคำของคุณ', onclick: () => cb.onAiTheme() }, '✨ AI');
    const themeWrap = el('label', { class: 'group' }, el('span', { class: 'lbl' }, '🎨 ขาว/กระดาน'), themeSel, aiThemeBtn);

    const blackSel = el('select', { class: 'select', onchange: (e: Event) => cb.onBlackTheme((e.target as HTMLSelectElement).value) }) as HTMLSelectElement;
    opts.themes.forEach((t) => blackSel.append(el('option', { value: t.id }, `${t.emoji} ${t.name}`)));
    blackSel.value = init.blackThemeId;
    this.blackSel = blackSel;
    const blackWrap = el('label', { class: 'group' }, el('span', { class: 'lbl' }, '🎨 ดำ'), blackSel);

    // --- sound ---
    const soundSel = el('select', { class: 'select', onchange: (e: Event) => cb.onSound((e.target as HTMLSelectElement).value) }) as HTMLSelectElement;
    opts.packs.forEach((p) => soundSel.append(el('option', { value: p.id }, p.name)));
    soundSel.value = init.soundId;
    this.muteBtn = el('button', { class: 'btn icon', onclick: () => cb.onMute(!this.muteBtn.classList.contains('muted')) }, '🔊') as HTMLButtonElement;
    const vol = el('input', {
      class: 'range',
      type: 'range',
      min: '0',
      max: '1',
      step: '0.05',
      value: String(init.volume),
      oninput: (e: Event) => cb.onVolume(parseFloat((e.target as HTMLInputElement).value)),
    });
    const soundWrap = el('label', { class: 'group' }, el('span', { class: 'lbl' }, '🔊 เสียง'), soundSel, this.muteBtn, vol);
    this.themeSel = themeSel;
    this.soundSel = soundSel;

    // --- actions ---
    const newBtn = el('button', { class: 'btn primary', onclick: () => cb.onNewGame() }, '♻️ เกมใหม่');
    const undoBtn = el('button', { class: 'btn', onclick: () => cb.onUndo() }, '↩️ ย้อน');
    const actions = el('div', { class: 'group' }, newBtn, undoBtn);

    const dock = el('div', { class: 'dock' }, modeSeg, this.diffWrap, this.aiSideWrap, this.onlineWrap, themeWrap, blackWrap, soundWrap, actions);

    // --- history panel ---
    this.historyOl = el('ol', { class: 'history' });
    const sidepanel = el('div', { class: 'sidepanel' }, el('h4', {}, '📜 ประวัติการเดิน'), this.historyOl);

    // --- game over overlay ---
    this.overlayMsg = el('div', { class: 'msg' });
    const playAgain = el('button', { class: 'btn primary big', onclick: () => cb.onNewGame() }, 'เล่นใหม่');
    this.overlay = el('div', { class: 'overlay hidden' }, el('div', { class: 'card' }, this.overlayMsg, playAgain));

    root.append(topbar, sidepanel, dock, this.overlay);

    this.setMuted(init.muted);
    this.setMode(init.mode);
    this.setAiSide(init.aiSide);
  }

  private themeSel!: HTMLSelectElement;
  private blackSel!: HTMLSelectElement;
  private soundSel!: HTMLSelectElement;

  setTurn(color: Side): void {
    this.turnBadge.className = `badge ${color}`;
    this.turnText.textContent = color === 'white' ? 'ตาขาว' : 'ตาดำ';
  }

  setStatus(text: string, kind: 'normal' | 'check' | 'over' = 'normal'): void {
    if (this.thinking) return;
    this.statusEl.textContent = text;
    this.statusEl.className = `status ${kind}`;
  }

  setThinking(b: boolean): void {
    this.thinking = b;
    if (b) {
      this.statusEl.textContent = '🤖 AI กำลังคิด…';
      this.statusEl.className = 'status thinking';
    } else {
      this.statusEl.textContent = '';
      this.statusEl.className = 'status';
    }
  }

  setMode(m: Mode): void {
    this.modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
    this.diffWrap.style.display = m === 'ai' ? '' : 'none';
    this.aiSideWrap.style.display = m === 'ai' ? '' : 'none';
    this.onlineWrap.style.display = m === 'online' ? '' : 'none';
  }

  setOnlineStatus(text: string): void {
    this.onlineStatusEl.textContent = text;
  }

  setAiSide(s: Side): void {
    this.aiSideBtns[0].classList.toggle('active', s === 'white');
    this.aiSideBtns[1].classList.toggle('active', s === 'black');
  }

  setHistory(items: { n: number; text: string; color: Side }[]): void {
    this.historyOl.replaceChildren(...items.map((it) => el('li', { class: it.color }, el('span', { class: 'mv' }, it.text))));
    this.historyOl.scrollTop = this.historyOl.scrollHeight;
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

  showOverlay(msg: string): void {
    this.overlayMsg.textContent = msg;
    this.overlay.classList.remove('hidden');
  }
  hideOverlay(): void {
    this.overlay.classList.add('hidden');
  }
}
