import { createGltfTheme } from './gltfTheme';
import type { Theme } from './types';

// GitHub Pages เสิร์ฟที่ subpath → prefix ด้วย BASE_URL ให้โหลด GLB ถูก path
const B = import.meta.env.BASE_URL;

/**
 * ธีม "ฮีโร่" — โมเดล 3D ที่สร้างด้วย AI (rig + เดิน)
 * กัปตันฮีโร่=ขุน · ฮีโร่หญิง=เม็ด · จอมเวท=โคน · มอเตอร์ไซค์หัวม้า=ม้า · ฐานป้อม=เรือ · sidekick=เบี้ย
 */
export const superhero: Theme = createGltfTheme({
  id: 'superhero',
  name: 'ฮีโร่',
  emoji: '🦸',
  description: 'ซูเปอร์ฮีโร่ — กัปตัน/ฮีโร่หญิง/จอมเวท/มอเตอร์ไซค์ เดินได้',
  defaultSoundPack: 'scifi',
  board: {
    light: 0xdbe3f2,
    dark: 0x3d4f7a,
    frame: 0x202b45,
    select: 0x49a0ff,
    move: 0x49c96d,
    capture: 0xff4d4d,
    lastMove: 0xffcc33,
    roughness: 0.55,
    metalness: 0.15,
    accent: 0xffcc33, // ขอบทองสไตล์ฮีโร่
  },
  environment: {
    background: 0x12203d,
    backdrop: 'grid',
    hemi: { sky: 0xdfe9ff, ground: 0x223150, intensity: 1.1 },
    dir: { color: 0xffffff, intensity: 2.0 },
    ambient: 0x33415e,
  },
  manifest: {
    models: {
      khun: B + 'themes/hero/khun.glb',
      met: B + 'themes/hero/met.glb',
      khon: B + 'themes/hero/khon.glb',
      ma: B + 'themes/hero/ma.glb',
      rua: B + 'themes/hero/rua.glb',
      bia: B + 'themes/hero/bia.glb',
    },
    targetHeight: 1.15,
    rotation: { ma: Math.PI / 2 }, // มอเตอร์ไซค์เจนแบบ side view (หัว=local −x) → หมุนให้หน้ารถหันเข้าหาคู่ต่อสู้
  },
});
