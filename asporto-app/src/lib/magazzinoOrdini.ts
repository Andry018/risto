import type { MagazzinoArticolo } from '../types/entities';

export type StockLevel = 'finito' | 'basso' | 'ok';

/** finito = 0, basso = sotto o alla soglia minima, ok = sopra. Senza soglia (0) non è mai "basso". */
export function stockLevel(a: Pick<MagazzinoArticolo, 'quantita' | 'soglia_minima'>): StockLevel {
  if (a.quantita <= 0) return 'finito';
  if (a.soglia_minima > 0 && a.quantita <= a.soglia_minima) return 'basso';
  return 'ok';
}

/**
 * Quanto ordinare per tornare a una scorta comoda: fino al doppio della soglia minima.
 * Arrotondato per eccesso (a 0,5 per kg/L, all'unità per il resto). 0 se non serve.
 */
export function suggestedOrder(a: Pick<MagazzinoArticolo, 'quantita' | 'soglia_minima' | 'unita_misura'>): number {
  if (stockLevel(a) === 'ok') return 0;
  const target = Math.max(a.soglia_minima * 2, a.soglia_minima + 1);
  const missing = Math.max(0, target - Math.max(0, a.quantita));
  const fine = ['kg', 'L'].includes(a.unita_misura);
  return fine ? Math.ceil(missing * 2) / 2 : Math.ceil(missing);
}

export interface OrderGroup {
  fornitore: string; // 'Senza fornitore' se non impostato
  righe: { articolo: MagazzinoArticolo; quantita: number }[];
}

/** Articoli da ordinare, raggruppati per fornitore (gruppi e righe in ordine alfabetico). */
export function buildOrderGroups(articoli: MagazzinoArticolo[], fornitoreName: (id?: string | null) => string | undefined): OrderGroup[] {
  const groups = new Map<string, OrderGroup>();
  for (const a of articoli) {
    const q = suggestedOrder(a);
    if (q <= 0) continue;
    const f = fornitoreName(a.fornitore_id) || 'Senza fornitore';
    if (!groups.has(f)) groups.set(f, { fornitore: f, righe: [] });
    groups.get(f)!.righe.push({ articolo: a, quantita: q });
  }
  return [...groups.values()]
    .map(g => ({ ...g, righe: g.righe.sort((x, y) => x.articolo.nome.localeCompare(y.articolo.nome, 'it')) }))
    .sort((x, y) => (x.fornitore === 'Senza fornitore' ? 1 : y.fornitore === 'Senza fornitore' ? -1 : x.fornitore.localeCompare(y.fornitore, 'it')));
}

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/** Testo pronto da mandare al fornitore (WhatsApp, SMS, mail). */
export function orderText(group: OrderGroup, ristorante = 'Ristorante Il Girasole'): string {
  const righe = group.righe.map(r => `• ${r.articolo.nome}: ${fmtQty(r.quantita)} ${r.articolo.unita_misura}`);
  const saluto = group.fornitore === 'Senza fornitore' ? 'Lista della spesa' : `Buongiorno, ordine per ${ristorante}:`;
  return [saluto, '', ...righe, '', 'Grazie!'].join('\n');
}
