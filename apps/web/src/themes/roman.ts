import * as THREE from 'three';
import type { Color, PieceType } from '@makruk/engine';
import type { Theme } from './types';
import { makeTurnedPiece, type Palette } from './_shared';

const bronze = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 0.8, roughness: 0.35 });

const white: Palette = {
  body: new THREE.MeshStandardMaterial({ color: 0xece9df, roughness: 0.6, metalness: 0.0 }),
  accent: bronze,
};
const black: Palette = {
  body: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.55, metalness: 0.05 }),
  accent: bronze,
};

export const roman: Theme = {
  id: 'roman',
  name: 'โรมัน',
  emoji: '🏛️',
  description: 'หินอ่อน/บรอนซ์ คลาสสิก',
  defaultSoundPack: 'stone',
  board: {
    light: 0xddd3c0,
    dark: 0x6e6357,
    frame: 0x44392d,
    select: 0x57b85a,
    move: 0x86cf7a,
    capture: 0xc6553f,
    lastMove: 0xd9b25a,
    roughness: 0.8,
    metalness: 0.0,
  },
  environment: {
    background: 0x1c1813,
    backdrop: 'none',
    hemi: { sky: 0xf3ead6, ground: 0x2a241c, intensity: 0.65 },
    dir: { color: 0xffe9c8, intensity: 1.35 },
    ambient: 0x3a342a,
    fog: { color: 0x1c1813, near: 18, far: 36 },
  },
  buildPiece: (t: PieceType, c: Color) => makeTurnedPiece(t, c === 'white' ? white : black),
};
