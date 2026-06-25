import { createGltfTheme } from './gltfTheme';
import type { Theme } from './types';

// GitHub Pages เสิร์ฟที่ subpath → prefix ด้วย BASE_URL ให้โหลด GLB ถูก path
const B = import.meta.env.BASE_URL;

/**
 * ธีม "ตำนานไทย" — ตัวหมาก 3D ที่สร้างด้วย AI (image→3D) แล้วฝังมาในแอป
 * ครุฑ=ขุน · อัปสร=เม็ด · ฤๅษี=โคน · ม้าทรงเทพ=ม้า · นาค=เรือ · ยักษ์=เบี้ย
 */
export const thaiMyth: Theme = createGltfTheme({
  id: 'thai-myth',
  name: 'ตำนานไทย',
  emoji: '🐉',
  description: 'ครุฑ/อัปสร/ฤๅษี/ม้าทรง/นาค/ยักษ์ — โมเดล 3D จาก AI',
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
    accent: 0xd4af37,
  },
  environment: {
    background: 0x241a10,
    sky: { top: 0x3a2a55, horizon: 0xc9803f, bottom: 0x18100a }, // วัดยามพระอาทิตย์ตก
    backdrop: 'none',
    hemi: { sky: 0xffe9c2, ground: 0x3a2a18, intensity: 0.75 },
    dir: { color: 0xfff1d6, intensity: 1.4 },
    ambient: 0x402e1c,
    fog: { color: 0x241a10, near: 18, far: 38 },
  },
  manifest: {
    models: {
      khun: B + 'themes/thai/khun.glb',
      met: B + 'themes/thai/met.glb',
      khon: B + 'themes/thai/khon.glb',
      ma: B + 'themes/thai/ma.glb',
      rua: B + 'themes/thai/rua.glb',
      bia: B + 'themes/thai/bia.glb',
    },
    targetHeight: 1.15,
    rotation: { ma: -Math.PI / 2 }, // ม้าเจนแบบ side view → หมุนให้หัวหันเข้าหาคู่ต่อสู้
  },
});
