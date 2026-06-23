import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';

type Handler = (payload: Record<string, unknown>) => void;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function genRoomCode(len = 4): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

// id ต่อ session ของแอป (RN ไม่มี localStorage/crypto.randomUUID)
const PLAYER_ID = 'm-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * เซสชันออนไลน์ผ่าน Supabase Realtime — โปรโตคอลเดียวกับเว็บ (channel `mk:CODE`, event `msg`)
 * จึงเล่นข้ามกับผู้เล่นบนเว็บได้
 */
export class OnlineSession {
  readonly playerId = PLAYER_ID;
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
