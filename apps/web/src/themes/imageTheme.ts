import * as THREE from 'three';
import type { Color, PieceType } from '@makruk/engine';
import type { Theme } from './types';

const loader = new THREE.TextureLoader();
const HEIGHT: Record<PieceType, number> = { khun: 1.55, met: 1.32, rua: 1.26, ma: 1.32, khon: 1.32, bia: 1.0 };

export interface ImageThemeManifest {
  id: string;
  name: string;
  images: Partial<Record<PieceType, string>>;
}

/** สร้างธีมจากภาพที่ AI สร้าง — แสดงหมากเป็น "การ์ดตั้ง" ที่มี texture เป็นรูป */
export function createImageTheme(m: ImageThemeManifest): Theme {
  const texCache: Partial<Record<PieceType, THREE.Texture>> = {};
  const whiteBase = new THREE.MeshStandardMaterial({ color: 0xeae3d6, roughness: 0.7 });
  const blackBase = new THREE.MeshStandardMaterial({ color: 0x2f2e36, roughness: 0.7 });

  function tex(type: PieceType): THREE.Texture | null {
    const url = m.images[type];
    if (!url) return null;
    if (!texCache[type]) {
      const t = loader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      texCache[type] = t;
    }
    return texCache[type]!;
  }

  return {
    id: m.id,
    name: m.name,
    emoji: '✨',
    description: 'ธีมที่ AI สร้างจากคำของคุณ',
    defaultSoundPack: 'soft',
    board: {
      light: 0xe9e4da,
      dark: 0x6f6657,
      frame: 0x453b2f,
      select: 0x3aa0ff,
      move: 0x49c96d,
      capture: 0xff5a5a,
      lastMove: 0xffc24e,
      roughness: 0.8,
    },
    environment: {
      background: 0x15171c,
      backdrop: 'none',
      hemi: { sky: 0xeef2f7, ground: 0x22252b, intensity: 0.9 },
      dir: { color: 0xffffff, intensity: 1.2 },
      ambient: 0x3a3f47,
    },
    buildPiece: (type: PieceType, color: Color) => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.12, 24), color === 'white' ? whiteBase : blackBase);
      base.position.y = 0.06;
      base.castShadow = true;
      g.add(base);

      const t = tex(type);
      const h = HEIGHT[type];
      const mat = t
        ? new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ color: color === 'white' ? 0xcccccc : 0x444444, side: THREE.DoubleSide });
      const card = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.82, h), mat);
      card.position.y = 0.12 + h / 2;
      g.add(card);
      return g;
    },
  };
}
