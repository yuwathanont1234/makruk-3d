import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

// preload ไฟล์เสียง (require → Metro bundle เป็น asset)
const FILES: Record<string, number> = {
  'move-bia': require('../../assets/sounds/move-bia.wav'),
  'move-ma': require('../../assets/sounds/move-ma.wav'),
  'move-khon': require('../../assets/sounds/move-khon.wav'),
  'move-met': require('../../assets/sounds/move-met.wav'),
  'move-rua': require('../../assets/sounds/move-rua.wav'),
  'move-khun': require('../../assets/sounds/move-khun.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  select: require('../../assets/sounds/select.wav'),
  check: require('../../assets/sounds/check.wav'),
  checkmate: require('../../assets/sounds/checkmate.wav'),
  promote: require('../../assets/sounds/promote.wav'),
  start: require('../../assets/sounds/start.wav'),
};

export type SoundEvent = 'move' | 'capture' | 'select' | 'check' | 'checkmate' | 'promote' | 'start';

/** เล่นเสียงบนมือถือผ่าน expo-audio (เสียงเฉพาะหมากแต่ละตัวสำหรับ move) */
export class SoundManager {
  private players: Record<string, AudioPlayer> = {};
  private muted = false;
  private ready = false;

  constructor() {
    try {
      for (const k in FILES) this.players[k] = createAudioPlayer(FILES[k]);
      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
  }
  get isMuted(): boolean {
    return this.muted;
  }

  play(event: SoundEvent, pieceType?: string): void {
    if (this.muted || !this.ready) return;
    const key = event === 'move' && pieceType ? `move-${pieceType}` : event;
    const p = this.players[key] ?? this.players[event];
    if (!p) return;
    try {
      p.seekTo(0);
      p.play();
    } catch {
      /* ignore */
    }
  }
}
