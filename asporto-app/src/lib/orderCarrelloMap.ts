import type { Ingredient, OrderCarrelloItem, Product } from '../types/entities';

const norm = (s: string) => s.trim().toLowerCase();

/** Match robusto nome prodotto/riga ordine (evita base sbagliata se maiuscole/spazi differiscono). */
export function findProductForOrderLine(products: Product[], nomeRiga: string): Product | undefined {
  const n = norm(nomeRiga);
  return products.find((p) => norm(p.nome) === n);
}

export function findIngredientByName(ingredients: Ingredient[], name: string): Ingredient | undefined {
  const n = norm(name);
  return ingredients.find((i) => norm(i.nome) === n);
}

/**
 * Calcola il prezzo totale delle rimozioni per una riga d'ordine,
 * cercando ogni ingrediente rimosso nella tabella ingredienti e sommando prezzo_rimozione.
 */
export function calculateRemovalsPrice(
  removedNames: string[],
  ingredients: Ingredient[]
): number {
  return removedNames.reduce((sum, name) => {
    const ing = findIngredientByName(ingredients, name);
    return sum + (ing?.prezzo_rimozione ?? 0);
  }, 0);
}

/**
 * Ricostruisce aggiunte con prezzo da tabella ingredienti; se la somma non coincide con
 * `prezzo_unitario` salvato (es. nome ingrediente non trovato → prezzo 0), ripartisce la
 * differenza così il totale riga torna ad allinearsi al DB.
 */
export function addedIngredientsFromStoredOrderLine(
  item: OrderCarrelloItem,
  ingredients: Ingredient[],
  baseProductPrezzo: number,
  removalsPrice?: number
): { nome: string; prezzo: number }[] {
  const names = item.modifiche?.aggiunte ?? [];
  const rows = names.map((name: string) => {
    const ing = findIngredientByName(ingredients, name);
    return { nome: name, prezzo: ing?.prezzo ?? 0 };
  });

  const saved = item.prezzo_unitario;
  if (saved == null || !Number.isFinite(saved) || rows.length === 0) return rows;

  const removalsDeduction = removalsPrice ?? 0;
  const extrasTarget = Math.max(0, saved - baseProductPrezzo + removalsDeduction);
  const sum = rows.reduce((s, r) => s + r.prezzo, 0);
  if (Math.abs(sum - extrasTarget) < 0.02) return rows;

  // Con un solo ingrediente aggiunto non c'è ambiguità su come ripartire lo scarto:
  // meglio mantenere il prezzo noto dal catalogo piuttosto che alterarlo per far
  // tornare un totale salvato che può essere impreciso per altri motivi (es. sconto).
  if (rows.length === 1) return rows;

  // Con più ingredienti, non c'è modo di sapere a quale attribuire lo scarto:
  // lo ripartiamo in parti uguali invece che in proporzione al prezzo di catalogo
  // (la proporzione amplificherebbe l'errore sull'ingrediente più caro).
  const each = extrasTarget / rows.length;
  return rows.map((r) => ({ ...r, prezzo: each }));
}
