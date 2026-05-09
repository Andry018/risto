import type { Ingredient, OrderCarrelloItem, Product } from './supabase';

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
 * Ricostruisce aggiunte con prezzo da tabella ingredienti; se la somma non coincide con
 * `prezzo_unitario` salvato (es. nome ingrediente non trovato → prezzo 0), ripartisce la
 * differenza così il totale riga torna ad allinearsi al DB.
 */
export function addedIngredientsFromStoredOrderLine(
  item: OrderCarrelloItem,
  ingredients: Ingredient[],
  baseProductPrezzo: number
): { nome: string; prezzo: number }[] {
  const names = item.modifiche?.aggiunte ?? [];
  let rows = names.map((name: string) => {
    const ing = findIngredientByName(ingredients, name);
    return { nome: name, prezzo: ing?.prezzo ?? 0 };
  });

  const saved = item.prezzo_unitario;
  if (saved == null || !Number.isFinite(saved) || rows.length === 0) return rows;

  const extrasTarget = Math.max(0, saved - baseProductPrezzo);
  const sum = rows.reduce((s, r) => s + r.prezzo, 0);
  if (Math.abs(sum - extrasTarget) < 0.02) return rows;

  if (sum < 0.02) {
    const each = extrasTarget / rows.length;
    return rows.map((r) => ({ ...r, prezzo: each }));
  }

  const scale = extrasTarget / sum;
  return rows.map((r) => ({ ...r, prezzo: r.prezzo * scale }));
}
