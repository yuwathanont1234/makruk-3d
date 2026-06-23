import * as THREE from 'three';
import type { Color, PieceType } from '@makruk/engine';
import type { Theme } from './types';
import { makeTurnedPiece, type Palette } from './_shared';

const white: Palette = {
  body: new THREE.MeshStandardMaterial({
    color: 0x0a2540,
    emissive: 0x39d4ff,
    emissiveIntensity: 0.55,
    metalness: 0.6,
    roughness: 0.25,
  }),
  accent: new THREE.MeshStandardMaterial({ color: 0x39d4ff, emissive: 0x39d4ff, emissiveIntensity: 1.3, roughness: 0.2 }),
};
const black: Palette = {
  body: new THREE.MeshStandardMaterial({
    color: 0x2a0a40,
    emissive: 0xff4fd8,
    emissiveIntensity: 0.55,
    metalness: 0.6,
    roughness: 0.25,
  }),
  accent: new THREE.MeshStandardMaterial({ color: 0xff4fd8, emissive: 0xff4fd8, emissiveIntensity: 1.3, roughness: 0.2 }),
};

export const space: Theme = {
  id: 'space',
  name: 'อวกาศ',
  emoji: '🚀',
  description: 'นีออนเรืองแสง + ดวงดาว',
  defaultSoundPack: 'scifi',
  board: {
    light: 0x16203a,
    dark: 0x0a1024,
    frame: 0x050a18,
    select: 0x39ffd0,
    move: 0x39d4ff,
    capture: 0xff4f7a,
    lastMove: 0xc9a0ff,
    roughness: 0.3,
    metalness: 0.6,
  },
  environment: {
    background: 0x05060d,
    backdrop: 'stars',
    hemi: { sky: 0x2a3a6a, ground: 0x05060d, intensity: 0.35 },
    dir: { color: 0x8fb6ff, intensity: 0.8 },
    ambient: 0x101830,
    fog: { color: 0x05060d, near: 20, far: 42 },
  },
  buildPiece: (t: PieceType, c: Color) => makeTurnedPiece(t, c === 'white' ? white : black),
};
