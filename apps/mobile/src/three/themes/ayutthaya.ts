import * as THREE from 'three';
import type { Color, PieceType } from '@makruk/engine';
import type { Theme } from './types';
import { makeTurnedPiece, type Palette } from './_shared';

const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3 });

const white: Palette = {
  body: new THREE.MeshStandardMaterial({ color: 0xe8d3a1, roughness: 0.55, metalness: 0.05 }),
  accent: goldMat,
};
const black: Palette = {
  body: new THREE.MeshStandardMaterial({ color: 0x5a2f1a, roughness: 0.5, metalness: 0.05 }),
  accent: goldMat,
};

export const ayutthaya: Theme = {
  id: 'ayutthaya',
  name: 'อยุธยา',
  emoji: '🏯',
  description: 'ไม้กลึงโบราณ ขอบทอง',
  defaultSoundPack: 'thai',
  board: {
    light: 0xe3c79a,
    dark: 0x7a4a25,
    frame: 0x3a2415,
    select: 0x49c96d,
    move: 0x6bd07a,
    capture: 0xe2554b,
    lastMove: 0xf2c14e,
    roughness: 0.7,
    metalness: 0.05,
  },
  environment: {
    background: 0x241a10,
    backdrop: 'none',
    hemi: { sky: 0xffe9c2, ground: 0x3a2a18, intensity: 0.6 },
    dir: { color: 0xfff1d6, intensity: 1.5 },
    ambient: 0x402e1c,
    fog: { color: 0x241a10, near: 16, far: 34 },
  },
  buildPiece: (t: PieceType, c: Color) => makeTurnedPiece(t, c === 'white' ? white : black),
};
