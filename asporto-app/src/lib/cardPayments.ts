/**
 * Registro pagamenti carta (tabella `pagamenti_carta`) + storno.
 * Ogni tentativo di pagamento dal CardPaymentModal viene registrato, anche se rifiutato
 * o con esito sconosciuto, per riconciliare con il rapporto del POS a fine giornata.
 */

import { supabase } from './supabase';
import { newUniqueId } from './id';
import { getCurrentUser } from './staffAuth';
import { getSetting, SETTINGS_KEYS } from './appSettings';
import type { PaymentResult } from './ecrAgent';

export type CardPaymentOutcome = 'APPROVATO' | 'RIFIUTATO' | 'NON_ESEGUITO' | 'SCONOSCIUTO';

export interface CardPayment {
  id: string;
  created_at: string;
  riferimento: string;
  quota: string | null;
  importo: number;
  esito: CardPaymentOutcome;
  stan: string | null;
  auth_code: string | null;
  tx_id: string | null;
  recuperato: boolean;
  errore: string | null;
  operatore: string;
  stornato_at: string | null;
  storno_tipo: 'ECR' | 'MANUALE' | null;
  storno_operatore: string | null;
  storno_note: string | null;
}

const PENDING_KEY = 'risto_pending_card_payments';

function outcomeOf(result: PaymentResult): CardPaymentOutcome {
  switch (result.outcome) {
    case 'approved': return 'APPROVATO';
    case 'declined': return 'RIFIUTATO';
    case 'not_executed': return 'NON_ESEGUITO';
    case 'unknown': return 'SCONOSCIUTO';
  }
  // Agent vecchio senza `outcome`
  if (result.ok) return 'APPROVATO';
  return result.uncertain ? 'SCONOSCIUTO' : 'RIFIUTATO';
}

function readPending(): Omit<CardPayment, 'created_at'>[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}

function writePending(rows: Omit<CardPayment, 'created_at'>[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(rows)); } catch { /* storage pieno */ }
}

/** Riprova a salvare le righe rimaste in coda (es. DB irraggiungibile al momento del pagamento) */
async function flushPending(): Promise<void> {
  const pending = readPending();
  if (!pending.length || !supabase) return;
  // upsert su id: se una riga era già arrivata, non viene duplicata
  const { error } = await supabase.from('pagamenti_carta').upsert(pending, { onConflict: 'id' });
  if (!error) writePending([]);
}

/**
 * Registra l'esito di un tentativo di pagamento. Non lancia mai: un errore del registro
 * non deve bloccare la chiusura del conto (la riga resta in coda locale e riparte dopo).
 */
export async function recordCardPayment(
  result: PaymentResult | null,
  ctx: { riferimento: string; importo: number; quota?: string; errore?: string },
): Promise<void> {
  const row: Omit<CardPayment, 'created_at'> = {
    id: newUniqueId(),
    riferimento: ctx.riferimento,
    quota: ctx.quota ?? null,
    importo: Math.round(ctx.importo * 100) / 100,
    // Nessuna risposta dall'agent (rete caduta a metà): esito sconosciuto
    esito: result ? outcomeOf(result) : 'SCONOSCIUTO',
    stan: result?.stan ?? null,
    auth_code: result?.authCode ?? null,
    tx_id: result?.txId ?? null,
    recuperato: !!result?.recovered,
    errore: ctx.errore ?? result?.error ?? null,
    operatore: getCurrentUser()?.name ?? '',
    stornato_at: null,
    storno_tipo: null,
    storno_operatore: null,
    storno_note: null,
  };
  writePending([...readPending(), row]);
  try { await flushPending(); } catch { /* resta in coda */ }
}

/** Pagamenti di un giorno (YYYY-MM-DD, ora locale), più recenti prima */
export async function fetchCardPayments(day: string): Promise<CardPayment[]> {
  if (!supabase) return [];
  try { await flushPending(); } catch { /* ignora */ }
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 1);
  const { data, error } = await supabase
    .from('pagamenti_carta')
    .select('*')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(r => ({ ...r, importo: Number(r.importo) })) as CardPayment[];
}

/** Segna una transazione come stornata (dal gestionale via ECR o a mano sul terminale) */
export async function markReversed(id: string, tipo: 'ECR' | 'MANUALE', note = ''): Promise<void> {
  if (!supabase) throw new Error('Database non disponibile');
  const { error } = await supabase.from('pagamenti_carta').update({
    stornato_at: new Date().toISOString(),
    storno_tipo: tipo,
    storno_operatore: getCurrentUser()?.name ?? '',
    storno_note: note || null,
  }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Esito sconosciuto verificato a mano sul POS (per far tornare i totali) */
export async function resolveUnknown(id: string, esito: 'APPROVATO' | 'NON_ESEGUITO'): Promise<void> {
  if (!supabase) throw new Error('Database non disponibile');
  const who = getCurrentUser()?.name ?? '';
  const { error } = await supabase.from('pagamenti_carta')
    .update({ esito, errore: `Esito verificato a mano sul POS${who ? ` da ${who}` : ''}` })
    .eq('id', id).eq('esito', 'SCONOSCIUTO');
  if (error) throw new Error(error.message);
}

/** Secret del Pannello Sistema: richiesto dall'ECR agent per lo storno */
export function getAdminSecret(): string {
  return getSetting(SETTINGS_KEYS.systemPanelSecret, '');
}
