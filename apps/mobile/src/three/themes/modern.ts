import * as THREE from 'three';
import type { Color, PieceType } from '@makruk/engine';
import type { Theme } from './types';
import { makeTurnedPiece, type Palette } from './_shared';

const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.35 });

const white: Palette = {
  body: new THREE.MeshStandardMaterial({ color: 0xf2f4f7, metalness: 0.1, roughness: 0.4 }),
  accent: steel,
};
const black: Palette = {
  body: new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.2, roughness: 0.45 }),
  accent: steel,
};

export const modern: Theme = {
  id: 'modern',
  name: 'โมเดิร์น',
  emoji: '⬜',
  description: 'มินิมอล แมตต์/โลหะ',
  defaultSoundPack: 'soft',
  board: {
    light: 0xe2e6eb,
    dark: 0x394049,
    frame: 0x1c2026,
    select: 0x3aa0ff,
    move: 0x49c96d,
    capture: 0xff5a5a,
    lastMove: 0x6fc3ff,
    roughness: 0.5,
    metalness: 0.2,
  },
  environment: {
    background: 0x12151a,
    backdrop: 'none',
    hemi: { sky: 0xdfe6ef, ground: 0x20242b, intensity: 0.7 },
    dir: { color: 0xffffff, intensity: 1.3 },
    ambient: 0x303640,
  },
  buildPiece: (t: PieceType, c: Color) => makeTurnedPiece(t, c === 'white' ? white : black),
};
