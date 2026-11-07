import { toLocalISODate } from './dateUtils';

export type ScadenzaStato = 'scaduto' | 'oggi' | 'domani' | 'ok';

/**
 * Stato di un'etichetta rispetto a oggi (date locali YYYY-MM-DD, niente UTC):
 * il giorno di scadenza è ancora valido fino a sera → 'oggi', non 'scaduto'.
 */
export function scadenzaStato(dataScadenza: string | null | undefined, today: Date = new Date()): ScadenzaStato {
  if (!dataScadenza) return 'ok';
  const d = dataScadenza.slice(0, 10);
  const oggi = toLocalISODate(today);
  if (d < oggi) return 'scaduto';
  if (d === oggi) return 'oggi';
  const domani = new Date(today);
  domani.setDate(domani.getDate() + 1);
  if (d === toLocalISODate(domani)) return 'domani';
  return 'ok';
}

export const isUrgente = (s: ScadenzaStato) => s !== 'ok';

/** Etichette urgenti prima (scadute, oggi, domani), poi per data di scadenza crescente. */
export function ordinaPerScadenza<T extends { data_scadenza: string }>(list: T[], today: Date = new Date()): T[] {
  const peso: Record<ScadenzaStato, number> = { scaduto: 0, oggi: 1, domani: 2, ok: 3 };
  return [...list].sort((a, b) =>
    peso[scadenzaStato(a.data_scadenza, today)] - peso[scadenzaStato(b.data_scadenza, today)]
    || (a.data_scadenza || '').localeCompare(b.data_scadenza || ''));
}
