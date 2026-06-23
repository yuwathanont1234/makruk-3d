import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';

type Handler = (payload: Record<string, unknown>) => void;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ตัดตัวที่สับสน (0/O, 1/I)

export function genRoomCode(len = 6): string {
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return s;
}

function getOrCreatePlayerId(): string {
  // ใช้ sessionStorage → แต่ละแท็บมี id ต่างกัน (เล่นทดสอบ 2 แท็บในเบราว์เซอร์เดียวได้)
  // และคงที่ข้ามการรีโหลดภายในแท็บเดิม
  const k = 'mk_player_id';
  let id = sessionStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(k, id);
  }
  return id;
}

/**
 * เซสชันออนไลน์ผ่าน Supabase Realtime (broadcast + presence)
 * เป็น "ท่อส่งข้อความ" ล้วน — ตรรกะเกม/โปรโตคอลอยู่ที่ main.ts
 */
export class OnlineSession {
  readonly playerId = getOrCreatePlayerId();
  role: 'host' | 'guest' = 'host';
  code = '';
  opponentPresent = false;

  private channel: RealtimeChannel | null = null;
  private handlers = new Map<string, Handler>();
  onPresence: ((present: boolean) => void) | null = null;

  on(type: string, h: Handler): void {
    this.handlers.set(type, h);
  }

  async connect(code: string, role: 'host' | 'guest'): Promise<void> {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase ยังไม่ถูกตั้งค่า');
    this.code = code;
    this.role = role;

    const ch = sb.channel(`mk:${code}`, {
      config: { broadcast: { self: false }, presence: { key: this.playerId } },
    });
    this.channel = ch;

    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      const type = (payload as { type?: string }).type;
      if (type) this.handlers.get(type)?.(payload as Record<string, unknown>);
    });

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const others = Object.keys(state).filter((k) => k !== this.playerId);
      const present = others.length > 0;
      if (present !== this.opponentPresent) {
        this.opponentPresent = present;
        this.onPresence?.(present);
      }
    });

    await new Promise<void>((resolve, reject) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void ch.track({ id: this.playerId, role });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(status));
        }
      });
    });
  }

  send(type: string, data: Record<string, unknown> = {}): void {
    this.channel?.send({ type: 'broadcast', event: 'msg', payload: { type, from: this.playerId, ...data } });
  }

  async leave(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    this.opponentPresent = false;
  }
}
