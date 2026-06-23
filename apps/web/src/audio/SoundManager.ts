import type { PieceType } from '@makruk/engine';
import { getPack, type EventName, type Sound, type SoundPack, type Tone } from './packs';

/** เล่นเสียงสังเคราะห์ด้วย WebAudio — ไม่ต้องโหลดไฟล์ */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private pack: SoundPack;
  private _volume = 0.6;
  private _muted = false;

  constructor(packId = 'thai') {
    this.pack = getPack(packId);
  }

  setPack(id: string): void {
    this.pack = getPack(id);
  }
  get packId(): string {
    return this.pack.id;
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this._muted ? 0 : this._volume;
  }
  get volume(): number {
    return this._volume;
  }

  setMuted(m: boolean): void {
    this._muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this._volume;
  }
  get muted(): boolean {
    return this._muted;
  }

  /** ปลดล็อก audio (เรียกตอนผู้ใช้โต้ตอบครั้งแรก) */
  unlock(): void {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private ensure(): void {
    if (this.ctx) return;
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : this._volume;
    this.master.connect(this.ctx.destination);
  }

  play(event: EventName, pieceType?: PieceType): void {
    if (this._muted) return;
    this.ensure();
    const ctx = this.ctx!;
    if (ctx.state === 'suspended') void ctx.resume();

    let sound: Sound | undefined;
    if (event === 'move' && pieceType) sound = this.pack.pieceMove?.[pieceType];
    else if (event === 'capture' && pieceType) sound = this.pack.pieceCapture?.[pieceType];
    sound = sound ?? this.pack.events[event];
    if (!sound) return;

    const now = ctx.currentTime;
    for (const t of sound) this.playTone(t, now + (t.delay ?? 0));
  }

  private playTone(t: Tone, when: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = t.type ?? 'sine';
    const f = Math.max(40, t.freq);
    osc.frequency.setValueAtTime(f, when);
    if (t.sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, f * t.sweep), when + t.dur);
    const peak = t.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + t.dur);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(when);
    osc.stop(when + t.dur + 0.03);
  }
}
