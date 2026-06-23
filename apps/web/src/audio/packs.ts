import type { PieceType } from '@makruk/engine';

export type EventName =
  | 'move'
  | 'capture'
  | 'check'
  | 'checkmate'
  | 'promote'
  | 'select'
  | 'illegal'
  | 'start'
  | 'end';

export interface Tone {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number; // หน่วงเวลาเริ่ม (วินาที)
  sweep?: number; // ความถี่ปลายทาง = freq * sweep
}
export type Sound = Tone[];

export interface SoundPack {
  id: string;
  name: string;
  events: Partial<Record<EventName, Sound>>;
  pieceMove?: Partial<Record<PieceType, Sound>>;
  pieceCapture?: Partial<Record<PieceType, Sound>>;
}

/** ความถี่ฐานของหมากแต่ละชนิด → ทำให้ "เสียงเฉพาะตัว" ต่างกัน */
const PIECE_FREQ: Record<PieceType, number> = {
  bia: 680,
  ma: 440,
  khon: 520,
  met: 600,
  rua: 300,
  khun: 380,
};

interface Voice {
  wave: OscillatorType;
  pitch: number;
  decay: number;
}

function buildPack(id: string, name: string, v: Voice): SoundPack {
  const w = v.wave;
  const p = v.pitch;
  const d = v.decay;

  const move = (f: number): Sound => [{ freq: f * p, dur: 0.12 * d, type: w, gain: 0.28 }];
  const cap = (f: number): Sound => [
    { freq: f * 0.6 * p, dur: 0.18 * d, type: 'square', gain: 0.34, sweep: 0.5 },
    { freq: f * p, dur: 0.1 * d, type: w, gain: 0.2, delay: 0.02 },
  ];

  const pieceMove: Record<PieceType, Sound> = {
    bia: move(PIECE_FREQ.bia),
    ma: [
      { freq: PIECE_FREQ.ma * p, dur: 0.08 * d, type: w, gain: 0.26 },
      { freq: PIECE_FREQ.ma * 1.18 * p, dur: 0.1 * d, type: w, gain: 0.26, delay: 0.09 },
    ],
    khon: move(PIECE_FREQ.khon),
    met: move(PIECE_FREQ.met),
    rua: [{ freq: PIECE_FREQ.rua * p, dur: 0.16 * d, type: w, gain: 0.32 }],
    khun: [
      { freq: PIECE_FREQ.khun * p, dur: 0.14 * d, type: w, gain: 0.3 },
      { freq: PIECE_FREQ.khun * 1.5 * p, dur: 0.12 * d, type: w, gain: 0.22, delay: 0.05 },
    ],
  };

  const pieceCapture: Record<PieceType, Sound> = {
    bia: cap(PIECE_FREQ.bia),
    ma: cap(PIECE_FREQ.ma),
    khon: cap(PIECE_FREQ.khon),
    met: cap(PIECE_FREQ.met),
    rua: cap(PIECE_FREQ.rua),
    khun: cap(PIECE_FREQ.khun),
  };

  const events: Partial<Record<EventName, Sound>> = {
    move: move(PIECE_FREQ.khon),
    capture: cap(PIECE_FREQ.rua),
    select: [{ freq: 900 * p, dur: 0.05, type: 'sine', gain: 0.14 }],
    illegal: [{ freq: 150 * p, dur: 0.16, type: 'square', gain: 0.22, sweep: 0.7 }],
    check: [
      { freq: 760 * p, dur: 0.12, type: w, gain: 0.3 },
      { freq: 920 * p, dur: 0.14, type: w, gain: 0.3, delay: 0.12 },
    ],
    checkmate: [
      { freq: 660 * p, dur: 0.18, type: w, gain: 0.32 },
      { freq: 520 * p, dur: 0.18, type: w, gain: 0.32, delay: 0.16 },
      { freq: 380 * p, dur: 0.4, type: w, gain: 0.34, delay: 0.32 },
    ],
    promote: [
      { freq: 520 * p, dur: 0.1, type: w, gain: 0.28 },
      { freq: 660 * p, dur: 0.1, type: w, gain: 0.28, delay: 0.1 },
      { freq: 790 * p, dur: 0.1, type: w, gain: 0.28, delay: 0.2 },
      { freq: 990 * p, dur: 0.22, type: w, gain: 0.3, delay: 0.3 },
    ],
    start: [
      { freq: 440 * p, dur: 0.12, type: w, gain: 0.26 },
      { freq: 660 * p, dur: 0.18, type: w, gain: 0.28, delay: 0.12 },
    ],
    end: [
      { freq: 392 * p, dur: 0.16, type: w, gain: 0.28 },
      { freq: 330 * p, dur: 0.3, type: w, gain: 0.3, delay: 0.14 },
    ],
  };

  return { id, name, events, pieceMove, pieceCapture };
}

export const SOUND_PACKS: SoundPack[] = [
  buildPack('thai', 'ไทยเดิม (ระนาด)', { wave: 'triangle', pitch: 1.05, decay: 1.1 }),
  buildPack('soft', 'นุ่มนวล', { wave: 'sine', pitch: 1.0, decay: 1.0 }),
  buildPack('stone', 'หิน/ไม้', { wave: 'triangle', pitch: 0.8, decay: 0.7 }),
  buildPack('scifi', 'ไซไฟ', { wave: 'sawtooth', pitch: 1.2, decay: 0.9 }),
  buildPack('office', 'ออฟฟิศ', { wave: 'square', pitch: 1.0, decay: 0.55 }),
];

export const DEFAULT_SOUND_PACK = 'thai';

export function getPack(id: string): SoundPack {
  return SOUND_PACKS.find((p) => p.id === id) ?? SOUND_PACKS[0];
}
