import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** มีการตั้งค่า Supabase ครบหรือยัง (ใช้ตัดสินว่าจะเปิดโหมดออนไลน์ได้ไหม) */
export const onlineAvailable = (): boolean => !!(URL && KEY);

export function getSupabase(): SupabaseClient | null {
  if (!URL || !KEY) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      realtime: { params: { eventsPerSecond: 20 } },
      auth: { persistSession: false },
    });
  }
  return client;
}
