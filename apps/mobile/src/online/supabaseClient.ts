import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// อ่านค่าจาก .env (EXPO_PUBLIC_* ถูก inline ตอน build)
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const onlineAvailable = (): boolean => !!(URL && KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!URL || !KEY) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      realtime: { params: { eventsPerSecond: 20 } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
