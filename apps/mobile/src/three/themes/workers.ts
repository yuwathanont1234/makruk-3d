import * as THREE from 'three';
import type { Color, PieceType } from '@makruk/engine';
import type { Theme } from './types';
import { makePeoplePiece, type Palette } from './_shared';

const white: Palette = {
  body: new THREE.MeshStandardMaterial({ color: 0xb9c0c9, roughness: 0.7 }), // สูทเทาอ่อน
  accent: new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 }), // พร็อพส้ม
  head: new THREE.MeshStandardMaterial({ color: 0xe7b48a, roughness: 0.8 }),
};
const black: Palette = {
  body: new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.7 }), // สูทกรมท่า
  accent: new THREE.MeshStandardMaterial({ color: 0x16b9a6, roughness: 0.6 }), // พร็อพเขียวน้ำเงิน
  head: new THREE.MeshStandardMaterial({ color: 0xb5835a, roughness: 0.8 }),
};

export const workers: Theme = {
  id: 'workers',
  name: 'คนทำงาน',
  emoji: '🧑‍💼',
  description: 'พนักงานออฟฟิศตัวจิ๋ว',
  defaultSoundPack: 'office',
  board: {
    light: 0xe8e2d8,
    dark: 0x9a8f7d,
    frame: 0x52493c,
    select: 0x3aa0ff,
    move: 0x49c96d,
    capture: 0xff5a5a,
    lastMove: 0xffc24e,
    roughness: 0.8,
    metalness: 0.0,
  },
  environment: {
    background: 0x1a1f26,
    backdrop: 'none',
    hemi: { sky: 0xeaf0f7, ground: 0x2a2f36, intensity: 0.8 },
    dir: { color: 0xffffff, intensity: 1.2 },
    ambient: 0x40464f,
  },
  buildPiece: (t: PieceType, c: Color) => makePeoplePiece(t, c === 'white' ? white : black),
};
