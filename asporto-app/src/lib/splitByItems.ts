import type { CustomizedItem, Ingredient } from '../types/entities';
import { calculateItemPrice, roundCents } from './priceUtils';
import { getItemKey } from './orderPending';

/** uniqueId della riga → pezzi selezionati da pagare */
export type ItemSelection = Record<string, number>;

/**
 * Divide il carrello in "pagato ora" e "resta sul tavolo" secondo la selezione.
 * Una riga da 3 coche con 1 selezionata diventa 1 pagata + 2 rimaste (stesso uniqueId sulla rimasta).
 */
export function applyItemSplit(cart: CustomizedItem[], selection: ItemSelection): { paid: CustomizedItem[]; remaining: CustomizedItem[] } {
  const paid: CustomizedItem[] = [];
  const remaining: CustomizedItem[] = [];
  for (const item of cart) {
    const sel = Math.max(0, Math.min(item.quantity, Math.floor(selection[item.uniqueId] || 0)));
    if (sel > 0) paid.push({ ...item, quantity: sel, uniqueId: `${item.uniqueId}-p` });
    if (item.quantity - sel > 0) remaining.push({ ...item, quantity: item.quantity - sel });
  }
  return { paid, remaining };
}

/**
 * Importo da incassare per i piatti scelti. Lo sconto del tavolo si applica in proporzione
 * (ratio = totale scontato / totale pieno), così la somma delle parti torna al totale.
 */
export function splitAmount(items: CustomizedItem[], ingredients: Ingredient[], ratio = 1): number {
  const full = items.reduce((s, i) => s + calculateItemPrice(i, ingredients), 0);
  return roundCents(full * ratio);
}

/** Toglie dalle quantità "già inviate in cucina" quelle appena pagate (non devono tornare "nuove"). */
export function subtractSaved(saved: Map<string, number>, paid: CustomizedItem[]): Map<string, number> {
  const next = new Map(saved);
  for (const item of paid) {
    const k = getItemKey(item);
    const left = (next.get(k) || 0) - item.quantity;
    if (left > 0) next.set(k, left);
    else next.delete(k);
  }
  return next;
}
