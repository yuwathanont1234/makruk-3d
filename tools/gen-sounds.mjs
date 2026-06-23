// สร้างไฟล์เสียง WAV (PCM16) สังเคราะห์ ให้แอปมือถือเล่นผ่าน expo-audio
// ออกแบบเสียงให้คล้ายชุด "ไทยเดิม" ของเว็บ (triangle, อุ่น ๆ) + เสียงเฉพาะหมากแต่ละตัว
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'mobile', 'assets', 'sounds');
mkdirSync(OUT, { recursive: true });

function osc(type, freq, time) {
  const ph = 2 * Math.PI * freq * time;
  switch (type) {
    case 'square':
      return Math.sin(ph) >= 0 ? 1 : -1;
    case 'sawtooth':
      return 2 * ((freq * time) % 1) - 1;
    case 'triangle':
      return 2 * Math.abs(2 * ((freq * time) % 1) - 1) - 1;
    default:
      return Math.sin(ph);
  }
}

function render(tones) {
  const end = Math.max(...tones.map((t) => (t.delay ?? 0) + t.dur)) + 0.05;
  const buf = new Float32Array(Math.ceil(end * SR));
  for (const t of tones) {
    const start = Math.floor((t.delay ?? 0) * SR);
    const len = Math.floor(t.dur * SR);
    for (let i = 0; i < len; i++) {
      const time = i / SR;
      const tt = i / len;
      const freq = t.sweep ? t.freq * (1 + (t.sweep - 1) * tt) : t.freq;
      const attack = Math.min(1, time / 0.008);
      const env = attack * Math.pow(0.0009, tt); // decay แบบ pluck
      const idx = start + i;
      if (idx < buf.length) buf[idx] += osc(t.type ?? 'triangle', freq, time) * env * (t.gain ?? 0.3);
    }
  }
  return buf;
}

function toWav(float) {
  const n = float.length;
  const ab = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(ab);
  const ws = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, 'RIFF');
  dv.setUint32(4, 36 + n * 2, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  ws(36, 'data');
  dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, float[i]));
    dv.setInt16(44 + i * 2, v < 0 ? v * 32768 : v * 32767, true);
  }
  return Buffer.from(ab);
}

const P = 1.05; // pitch (ชุดไทย)
const W = 'triangle';
const PIECE_FREQ = { bia: 680, ma: 440, khon: 520, met: 600, rua: 300, khun: 380 };

const SOUNDS = {
  'move-bia': [{ freq: PIECE_FREQ.bia * P, dur: 0.12, type: W, gain: 0.3 }],
  'move-ma': [
    { freq: PIECE_FREQ.ma * P, dur: 0.08, type: W, gain: 0.28 },
    { freq: PIECE_FREQ.ma * 1.18 * P, dur: 0.1, type: W, gain: 0.28, delay: 0.09 },
  ],
  'move-khon': [{ freq: PIECE_FREQ.khon * P, dur: 0.12, type: W, gain: 0.3 }],
  'move-met': [{ freq: PIECE_FREQ.met * P, dur: 0.12, type: W, gain: 0.3 }],
  'move-rua': [{ freq: PIECE_FREQ.rua * P, dur: 0.16, type: W, gain: 0.34 }],
  'move-khun': [
    { freq: PIECE_FREQ.khun * P, dur: 0.14, type: W, gain: 0.3 },
    { freq: PIECE_FREQ.khun * 1.5 * P, dur: 0.12, type: W, gain: 0.24, delay: 0.05 },
  ],
  capture: [
    { freq: 300 * 0.6 * P, dur: 0.18, type: 'square', gain: 0.36, sweep: 0.5 },
    { freq: 300 * P, dur: 0.1, type: W, gain: 0.22, delay: 0.02 },
  ],
  select: [{ freq: 900 * P, dur: 0.05, type: 'sine', gain: 0.16 }],
  check: [
    { freq: 760 * P, dur: 0.12, type: W, gain: 0.32 },
    { freq: 920 * P, dur: 0.14, type: W, gain: 0.32, delay: 0.12 },
  ],
  checkmate: [
    { freq: 660 * P, dur: 0.18, type: W, gain: 0.34 },
    { freq: 520 * P, dur: 0.18, type: W, gain: 0.34, delay: 0.16 },
    { freq: 380 * P, dur: 0.4, type: W, gain: 0.36, delay: 0.32 },
  ],
  promote: [
    { freq: 520 * P, dur: 0.1, type: W, gain: 0.3 },
    { freq: 660 * P, dur: 0.1, type: W, gain: 0.3, delay: 0.1 },
    { freq: 790 * P, dur: 0.1, type: W, gain: 0.3, delay: 0.2 },
    { freq: 990 * P, dur: 0.22, type: W, gain: 0.32, delay: 0.3 },
  ],
  start: [
    { freq: 440 * P, dur: 0.12, type: W, gain: 0.28 },
    { freq: 660 * P, dur: 0.18, type: W, gain: 0.3, delay: 0.12 },
  ],
};

let count = 0;
for (const [name, tones] of Object.entries(SOUNDS)) {
  writeFileSync(join(OUT, `${name}.wav`), toWav(render(tones)));
  count++;
}
console.log(`generated ${count} wav files -> ${OUT}`);
