import { supabase, IS_DEMO_MODE } from './supabase';
import { syncManager } from './OfflineSync';
import { toLocalISODate } from './dateUtils';
import type { Reservation, Tavolo } from '../types/entities';

/**
 * Più prenotazioni possono stare sullo stesso tavolo (es. pranzo e cena). Lo stato del tavolo
 * (`PRENOTATO`/`LIBERO`) riflette solo le prenotazioni CONFERMATE di OGGI: va ricalcolato con
 * `syncTableReservationStatus` dopo ogni modifica, mai impostato a mano su LIBERO/PRENOTATO.
 */

/** Ritardo tollerato: una prenotazione resta "quella di adesso" fino a 90 minuti dopo l'orario. */
const RITARDO_MIN = 90;

function minuti(ora: string | undefined | null): number {
  if (!ora) return 0;
  const [h, m] = ora.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Prenotazioni confermate di un tavolo, in ordine di orario. */
export function confirmedFor<T extends Pick<Reservation, 'tavolo_id' | 'status' | 'ora'>>(list: T[], tableId: string): T[] {
  return list
    .filter(r => r.tavolo_id === tableId && r.status === 'CONFERMATA')
    .sort((a, b) => minuti(a.ora) - minuti(b.ora));
}

/** La prenotazione di riferimento: la prima non ancora "scaduta" (orario + 90 min), altrimenti l'ultima. */
export function pickReservation<T extends Pick<Reservation, 'ora'>>(sorted: T[], now = new Date()): T | undefined {
  if (sorted.length === 0) return undefined;
  const adesso = now.getHours() * 60 + now.getMinutes();
  return sorted.find(r => minuti(r.ora) + RITARDO_MIN >= adesso) ?? sorted[sorted.length - 1];
}

/** Altre prenotazioni sullo stesso tavolo a meno di `finestraMin` minuti dall'orario indicato. */
export function nearbyReservations<T extends Pick<Reservation, 'id' | 'tavolo_id' | 'status' | 'ora'>>(
  list: T[], tableId: string, ora: string, excludeId?: string, finestraMin = 120,
): T[] {
  const m = minuti(ora);
  return confirmedFor(list, tableId).filter(r => r.id !== excludeId && Math.abs(minuti(r.ora) - m) < finestraMin);
}

/** Stato che il tavolo dovrebbe avere date le prenotazioni confermate di oggi. `null` = non toccare. */
export function desiredTableState(
  table: Pick<Tavolo, 'status' | 'clienti'>,
  todayConfirmed: Pick<Reservation, 'ora' | 'persone'>[],
  now = new Date(),
): { status: Tavolo['status']; clienti: number } | null {
  if (table.status === 'OCCUPATO') return null;
  // Contano solo le prenotazioni non ancora "scadute": un no-show di pranzo non blocca il tavolo tutto il giorno
  const adesso = now.getHours() * 60 + now.getMinutes();
  const next = [...todayConfirmed]
    .sort((a, b) => minuti(a.ora) - minuti(b.ora))
    .find(r => minuti(r.ora) + RITARDO_MIN >= adesso);
  if (next) {
    const clienti = next.persone || 0;
    return table.status === 'PRENOTATO' && table.clienti === clienti ? null : { status: 'PRENOTATO', clienti };
  }
  return table.status === 'PRENOTATO' ? { status: 'LIBERO', clienti: 0 } : null;
}

/** Riallinea lo stato dei tavoli indicati alle prenotazioni di oggi. Se una lettura fallisce non cambia nulla. */
export async function syncTableReservationStatus(...tableIds: (string | null | undefined)[]) {
  const ids = [...new Set(tableIds.filter((id): id is string => !!id))];
  if (ids.length === 0 || IS_DEMO_MODE || !supabase) return;
  const [tablesRes, resRes] = await Promise.all([
    supabase.from('tavoli').select('id, status, clienti').in('id', ids),
    supabase.from('prenotazioni').select('tavolo_id, ora, persone')
      .in('tavolo_id', ids).eq('data', toLocalISODate()).eq('status', 'CONFERMATA'),
  ]);
  if (tablesRes.error || resRes.error || !tablesRes.data || !resRes.data) return;
  for (const t of tablesRes.data as Pick<Tavolo, 'id' | 'status' | 'clienti'>[]) {
    const want = desiredTableState(t, (resRes.data as Pick<Reservation, 'tavolo_id' | 'ora' | 'persone'>[]).filter(r => r.tavolo_id === t.id));
    if (want) await syncManager.pushTableUpdate(t.id, want);
  }
}
