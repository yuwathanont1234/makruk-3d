import type { Theme } from './types';
import { ayutthaya } from './ayutthaya';
import { modern } from './modern';
import { space } from './space';
import { roman } from './roman';
import { aiHolo } from './aiHolo';
import { workers } from './workers';

/** ธีมทั้งหมดที่ใช้ได้ (procedural — ฟรี ไม่ต้องโหลดไฟล์) */
export const THEMES: Theme[] = [ayutthaya, modern, roman, space, aiHolo, workers];

export const DEFAULT_THEME_ID = 'ayutthaya';

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
