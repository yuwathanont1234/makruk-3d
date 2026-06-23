import * as THREE from 'three';
import type { Color, PieceType } from '@makruk/engine';
import type { Theme } from './types';
import { makeTurnedPiece, addEdges, type Palette } from './_shared';

const white: Palette = {
  body: new THREE.MeshStandardMaterial({
    color: 0x0bd1d1,
    emissive: 0x0bd1d1,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.32,
    metalness: 0.1,
    roughness: 0.4,
    depthWrite: false,
  }),
  accent: new THREE.MeshStandardMaterial({
    color: 0x9bf0ff,
    emissive: 0x9bf0ff,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  }),
};
const black: Palette = {
  body: new THREE.MeshStandardMaterial({
    color: 0xffa53a,
    emissive: 0xff7a1a,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.32,
    metalness: 0.1,
    roughness: 0.4,
    depthWrite: false,
  }),
  accent: new THREE.MeshStandardMaterial({
    color: 0xffd28a,
    emissive: 0xffb45a,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  }),
};

export const aiHolo: Theme = {
  id: 'ai-holo',
  name: 'AI โฮโลแกรม',
  emoji: '🤖',
  description: 'โฮโลแกรมโปร่งแสง + เส้นวงจร',
  defaultSoundPack: 'scifi',
  board: {
    light: 0x0c1830,
    dark: 0x081020,
    frame: 0x0a3a5a,
    select: 0x39ffd0,
    move: 0x39d4ff,
    capture: 0xff6a4f,
    lastMove: 0x9bf0ff,
    roughness: 0.3,
    metalness: 0.5,
  },
  environment: {
    background: 0x04070f,
    backdrop: 'grid',
    hemi: { sky: 0x1a3a5a, ground: 0x04070f, intensity: 0.4 },
    dir: { color: 0x8fe6ff, intensity: 0.7 },
    ambient: 0x0a1830,
    fog: { color: 0x04070f, near: 20, far: 44 },
  },
  buildPiece: (t: PieceType, c: Color) => {
    const o = makeTurnedPiece(t, c === 'white' ? white : black);
    addEdges(o, c === 'white' ? 0x9bf0ff : 0xffd28a);
    return o;
  },
};
