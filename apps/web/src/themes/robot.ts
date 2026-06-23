import { createGltfTheme } from './gltfTheme';
import type { Theme } from './types';

// GitHub Pages เสิร์ฟที่ subpath → prefix ด้วย BASE_URL ให้โหลด GLB ถูก path
const B = import.meta.env.BASE_URL;

/**
 * ธีม "อวกาศ/หุ่นยนต์" — โมเดล 3D ที่สร้างด้วย AI (rig + เดิน)
 * เมคราชา=ขุน · แอนดรอยด์ราชินี=เม็ด · หุ่นที่ปรึกษา=โคน · ม้าจักรกล=ม้า · จรวด=เรือ · หุ่นทหาร=เบี้ย
 */
export const spaceRobot: Theme = createGltfTheme({
  id: 'space-robot',
  name: 'อวกาศ/หุ่นยนต์',
  emoji: '🤖',
  description: 'หุ่นยนต์อวกาศ — เมคทองคำ/แอนดรอยด์/จรวด เดินได้',
  defaultSoundPack: 'scifi',
  board: {
    light: 0x404a5e,
    dark: 0x232a38,
    frame: 0x10141d,
    select: 0x3fd6ff,
    move: 0x5ce0c0,
    capture: 0xff5a7a,
    lastMove: 0x7c5cff,
    roughness: 0.35,
    metalness: 0.7,
    accent: 0x3fd6ff, // ขอบนีออนฟ้า
  },
  environment: {
    background: 0x0b1120,
    backdrop: 'stars',
    hemi: { sky: 0xcfe0ff, ground: 0x1a2030, intensity: 1.15 },
    dir: { color: 0xffffff, intensity: 2.1 },
    ambient: 0x33405c,
    fog: { color: 0x0b1120, near: 22, far: 46 },
  },
  manifest: {
    models: {
      khun: B + 'themes/robot/khun.glb',
      met: B + 'themes/robot/met.glb',
      khon: B + 'themes/robot/khon.glb',
      ma: B + 'themes/robot/ma.glb',
      rua: B + 'themes/robot/rua.glb',
      bia: B + 'themes/robot/bia.glb',
    },
    targetHeight: 1.15,
  },
});
