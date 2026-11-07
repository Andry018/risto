import type { Reservation } from '../types/entities';
import { getWaToken, waApi } from './whatsapp';
import { supabase, IS_DEMO_MODE } from './supabase';

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export type WaReservationKind = 'conferma' | 'promemoria';

/** Il tablet può mandare WhatsApp? (token salvato su questo dispositivo, vedi WhatsAppView) */
export function waAvailable(): boolean {
  return !IS_DEMO_MODE && !!getWaToken();
}

/**
 * Telefono scritto a mano → JID WhatsApp. Stesse regole della "Nuova chat":
 * cellulare italiano senza prefisso (10 cifre che iniziano per 3) → +39. null se non valido.
 */
export function phoneToJid(phone: string | undefined | null): string | null {
  let digits = (phone || '').replace(/\D/g, '').replace(/^00/, '');
  if (digits.length === 10 && digits.startsWith('3')) digits = `39${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `${digits}@s.whatsapp.net`;
}

/** 'YYYY-MM-DD' → 'sabato 8 novembre' (data locale, niente UTC) */
export function dayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${GIORNI[dt.getDay()]} ${d} ${MESI[m - 1]}`;
}

const firstName = (nome: string) => (nome || '').trim().split(/\s+/)[0] || '';
const hhmm = (ora: string) => (ora || '').split(':').slice(0, 2).join(':');
const persone = (n: number) => `${n} ${n === 1 ? 'persona' : 'persone'}`;

export function buildReservationText(res: Pick<Reservation, 'nome' | 'data' | 'ora' | 'persone'>, kind: WaReservationKind): string {
  const nome = firstName(res.nome);
  const ciao = nome ? `Ciao ${nome}!` : 'Ciao!';
  if (kind === 'conferma') {
    return `${ciao} Confermiamo la tua prenotazione al Ristorante Il Girasole per ${persone(res.persone)}, ${dayLabel(res.data)} alle ${hhmm(res.ora)}. 🌻\n`
      + `Per modifiche o disdette rispondi pure a questo messaggio. A presto!`;
  }
  return `${ciao} Ti ricordiamo la prenotazione di oggi al Girasole alle ${hhmm(res.ora)} per ${persone(res.persone)}. Ti aspettiamo! 🌻\n`
    + `Se hai un imprevisto rispondi a questo messaggio.`;
}

/**
 * Manda conferma o promemoria e lo segna sulla prenotazione (wa_conferma_at / wa_promemoria_at).
 * Lancia un errore con messaggio leggibile se il numero non va o WhatsApp non è raggiungibile.
 */
export async function sendReservationWhatsapp(res: Reservation, kind: WaReservationKind): Promise<string> {
  const jid = phoneToJid(res.telefono);
  if (!jid) throw new Error('Numero di telefono non valido per WhatsApp.');
  await waApi.send(jid, buildReservationText(res, kind));
  const at = new Date().toISOString();
  if (supabase) {
    const column = kind === 'conferma' ? 'wa_conferma_at' : 'wa_promemoria_at';
    await supabase.from('prenotazioni').update({ [column]: at }).eq('id', res.id);
  }
  return at;
}
