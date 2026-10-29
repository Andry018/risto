/**
 * Client per il WA Agent locale (WhatsApp via Evolution API).
 * Il token di accesso è salvato SOLO nel localStorage del dispositivo (mai in `impostazioni`,
 * che è leggibile con la anon key): le chat contengono dati personali dei clienti.
 */

import { useEffect, useState } from 'react';

const WA_URL = '/wa-agent';
const TOKEN_KEY = 'risto_wa_token';

export type WaConnectionState = 'open' | 'connecting' | 'close' | 'missing';

export interface WaMessage {
  id: string;
  jid: string;
  fromMe: boolean;
  pushName: string;
  /** secondi Unix */
  timestamp: number;
  kind: 'text' | 'image' | 'sticker' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'reaction' | 'other';
  text: string;
  status: string;
  phone: string;
}

export interface WaChat {
  jid: string;
  name: string;
  phone: string;
  isGroup: boolean;
  avatar: string | null;
  unread: number;
  lastMessage: WaMessage | null;
  /** ms Unix */
  updatedAt: number;
}

export type WaEvent =
  | { type: 'message'; message: WaMessage }
  | { type: 'status'; id: string; jid?: string; status: string }
  | { type: 'connection'; state: WaConnectionState }
  | { type: 'qr'; qr: string };

export class WaError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getWaToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function setWaToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { // storage bloccato (navigazione privata): token solo per la sessione
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${WA_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Wa-Token': getWaToken() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new WaError('WA agent non raggiungibile', 0);
  }
  const data = await res.json().catch(() => null) as ({ ok?: boolean; error?: string } & T) | null;
  if (!res.ok || !data?.ok) throw new WaError(data?.error || `HTTP ${res.status}`, res.status);
  return data;
}

export const waApi = {
  status: () => call<{ state: WaConnectionState }>('GET', '/status'),
  connect: () => call<{ state: WaConnectionState; qr: string | null; pairingCode: string | null }>('POST', '/connect'),
  logout: () => call<object>('POST', '/logout'),
  chats: () => call<{ chats: WaChat[] }>('GET', '/chats').then(r => r.chats),
  messages: (jid: string, limit = 60) =>
    call<{ messages: WaMessage[] }>('GET', `/messages?jid=${encodeURIComponent(jid)}&limit=${limit}`).then(r => r.messages),
  send: (jid: string, text: string) => call<{ message: WaMessage }>('POST', '/send', { jid, text }).then(r => r.message),
  markRead: (jid: string, ids: string[]) => call<object>('POST', '/read', { jid, ids }),
  media: (id: string) =>
    call<{ base64: string; mimetype: string }>('GET', `/media?id=${encodeURIComponent(id)}`)
      .then(r => `data:${r.mimetype};base64,${r.base64}`),
};

/** Eventi in tempo reale. EventSource si riconnette da solo se la rete cade. */
export function subscribeWa(onEvent: (e: WaEvent) => void, onOpen?: () => void): () => void {
  const token = getWaToken();
  if (!token || typeof EventSource === 'undefined') return () => {};
  const es = new EventSource(`${WA_URL}/events?token=${encodeURIComponent(token)}`);
  es.onmessage = ev => {
    try { onEvent(JSON.parse(ev.data) as WaEvent); } catch { /* evento malformato: ignorato */ }
  };
  if (onOpen) es.onopen = onOpen;
  return () => es.close();
}

/** Messaggi non letti totali, per il badge in dashboard. 0 se WhatsApp non è configurato su questo dispositivo. */
export function useWaUnread(): number {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!getWaToken()) return;
    let cancelled = false;
    const refresh = () => {
      waApi.chats()
        .then(chats => { if (!cancelled) setUnread(chats.reduce((s, c) => s + (c.isGroup ? 0 : c.unread), 0)); })
        .catch(() => {});
    };
    refresh();
    const unsub = subscribeWa(e => {
      if (e.type === 'message' && !e.message.fromMe && !e.message.jid.endsWith('@g.us')) setUnread(u => u + 1);
    });
    const id = setInterval(refresh, 120_000);
    return () => { cancelled = true; unsub(); clearInterval(id); };
  }, []);
  return unread;
}

/** '393331234567' → '+39 333 123 4567' (solo numeri italiani formattati, gli altri con +) */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  if (phone.startsWith('39') && phone.length >= 11) {
    const n = phone.slice(2);
    return `+39 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return `+${phone}`;
}

/** Confronto numeri ignorando prefisso, spazi e simboli (ultime 9 cifre). */
export function phonesMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  const da = (a || '').replace(/\D/g, '');
  const db = (b || '').replace(/\D/g, '');
  if (da.length < 6 || db.length < 6) return false;
  return da.slice(-9) === db.slice(-9);
}

export function chatTitle(chat: Pick<WaChat, 'name' | 'phone' | 'jid'>): string {
  return chat.name || formatPhone(chat.phone) || chat.jid.split('@')[0];
}

const KIND_LABEL: Record<WaMessage['kind'], string> = {
  text: '', image: '📷 Foto', sticker: '🏷️ Sticker', video: '🎥 Video', audio: '🎤 Messaggio vocale',
  document: '📄 Documento', location: '📍 Posizione', contact: '👤 Contatto', reaction: 'Reazione', other: 'Messaggio',
};

export function messagePreview(m: WaMessage): string {
  if (m.kind === 'text') return m.text;
  if (m.kind === 'reaction') return `Reazione ${m.text}`;
  return m.text ? `${KIND_LABEL[m.kind]}: ${m.text}` : KIND_LABEL[m.kind];
}

export function kindLabel(kind: WaMessage['kind']): string {
  return KIND_LABEL[kind];
}
