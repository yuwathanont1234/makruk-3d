import type * as THREE from 'three';
import type { Color, PieceType } from '@makruk/engine';

/** สีของกระดานและไฮไลต์ */
export interface BoardStyle {
  light: number; // สีช่องอ่อน
  dark: number; // สีช่องเข้ม
  frame: number; // กรอบกระดาน
  select: number; // ไฮไลต์ตัวที่เลือก
  move: number; // ช่องที่เดินได้
  capture: number; // ช่องที่กินได้
  lastMove: number; // ช่องตาเดินล่าสุด
  metalness?: number;
  roughness?: number;
  accent?: number; // สีขอบประดับ (เช่น ทอง) — มีไว้จะวาดกรอบยกขอบรอบกระดาน
}

/** ฉาก/แสง/พื้นหลัง */
export interface EnvironmentStyle {
  background: number; // สีพื้นหลัง (ใช้เมื่อไม่มี sky)
  /**
   * ท้องฟ้าไล่เฉดแนวตั้ง (บน→ขอบฟ้า→ล่าง) สร้าง "บรรยากาศ" รอบกระดาน
   * ถ้ามี → ใช้แทนสีพื้นหลังเรียบ; ถ้าไม่มี → fall back เป็น background สีเดียว (back-compat)
   */
  sky?: { top: number; horizon: number; bottom: number };
  backdrop?: 'stars' | 'grid' | 'none'; // ลูกเล่นพื้นหลัง (วาดทับท้องฟ้าได้ เช่น ดาว)
  fog?: { color: number; near: number; far: number };
  hemi: { sky: number; ground: number; intensity: number };
  dir: { color: number; intensity: number };
  ambient?: number;
}

export interface Theme {
  id: string;
  name: string; // ชื่อไทย
  description: string;
  emoji: string;
  defaultSoundPack: string;
  board: BoardStyle;
  environment: EnvironmentStyle;
  /** สร้างตัวหมาก 1 ตัว (ฐานอยู่ที่ y=0, ตั้งขึ้น +y) คืน Object3D */
  buildPiece(type: PieceType, color: Color): THREE.Object3D;
  /** โหลดทรัพยากร (ธีมที่ใช้โมเดล) — เรียกก่อนใช้งาน */
  preload?(): Promise<void>;
  /** อัปเดต animation ทุกเฟรม (เช่น AnimationMixer ของโมเดลที่มี rig) */
  update?(dt: number): void;
  /** เริ่ม/หยุด animation เดิน ตอนหมากเคลื่อนที่ — คืน true ถ้าตัวนี้มี animation เดิน */
  setMoving?(obj: THREE.Object3D, moving: boolean): boolean;
}
