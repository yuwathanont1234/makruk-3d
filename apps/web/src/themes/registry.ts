import type { Theme } from './types';
import { ayutthaya } from './ayutthaya';
import { modern } from './modern';
import { space } from './space';
import { roman } from './roman';
import { aiHolo } from './aiHolo';
import { workers } from './workers';
import { thaiMyth } from './thaiMyth';

/** ธีมทั้งหมดที่ใช้ได้ (procedural + ธีมโมเดล 3D ตำนานไทยที่ AI สร้าง) */
export const THEMES: Theme[] = [ayutthaya, modern, roman, space, aiHolo, workers, thaiMyth];

export const DEFAULT_THEME_ID = 'ayutthaya';

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
