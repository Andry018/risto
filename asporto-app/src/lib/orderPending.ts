import type { CustomizedItem, Ingredient } from '../types/entities';
import { calculateItemPrice, roundCents } from './priceUtils';

/** Chiave di una riga di carrello: stesse modifiche + stessa uscita = stessa riga in comanda. */
export function getItemKey(item: CustomizedItem): string {
  const adds = [...item.addedIngredients].map(a => a.nome).sort().join(',');
  const rems = [...item.removedIngredients].sort().join(',');
  return `${item.nome}|${item.portata || ''}|${adds}|${rems}|${item.notes}`;
}

/** Quantità per chiave di un carrello (quello che risulta salvato/inviato). */
export function qtyByKey(cart: CustomizedItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of cart) {
    const k = getItemKey(item);
    m.set(k, (m.get(k) || 0) + item.quantity);
  }
  return m;
}

export interface PendingSummary {
  /** uniqueId → quantità di quella riga NON ancora inviata in cucina */
  newQtyById: Map<string, number>;
  /** piatti nuovi da inviare (esclusi coperto/servizio) */
  count: number;
  /** importo dei piatti nuovi */
  amount: number;
  /** il carrello differisce da quanto salvato (nuovi piatti, tolti, modificati) */
  dirty: boolean;
}

/**
 * Confronta il carrello con le quantità già inviate e dice cosa è nuovo.
 * Le quantità salvate "coprono" le righe nell'ordine del carrello: ciò che eccede è nuovo.
 */
export function computePending(cart: CustomizedItem[], saved: Map<string, number>, ingredients: Ingredient[]): PendingSummary {
  const remaining = new Map(saved);
  const newQtyById = new Map<string, number>();
  let count = 0;
  let amount = 0;
  for (const item of cart) {
    const key = getItemKey(item);
    const available = remaining.get(key) || 0;
    const covered = Math.min(item.quantity, available);
    remaining.set(key, available - covered);
    const fresh = item.quantity - covered;
    if (fresh <= 0) continue;
    newQtyById.set(item.uniqueId, fresh);
    if (item.categoria !== 'Servizio') count += fresh;
    amount += (calculateItemPrice(item, ingredients) / item.quantity) * fresh;
  }
  const current = qtyByKey(cart);
  let dirty = current.size !== saved.size;
  if (!dirty) for (const [k, q] of current) if (saved.get(k) !== q) { dirty = true; break; }
  return { newQtyById, count, amount: roundCents(amount), dirty };
}
