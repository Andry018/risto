import type { Ingredient } from '../types/entities';

export interface PriceCalculableItem {
  prezzo: number;
  quantity: number;
  addedIngredients: { nome: string; prezzo: number }[];
  removedIngredients: string[];
}

export function calculateItemPrice(
  item: PriceCalculableItem,
  ingredients: Ingredient[]
): number {
  const extrasPrice = item.addedIngredients.reduce((sum, ing) => sum + ing.prezzo, 0);
  const removalsPrice = item.removedIngredients.reduce((sum, rName) => {
    const ing = ingredients.find(i => i.nome.toLowerCase() === rName.toLowerCase());
    return sum + (ing?.prezzo_rimozione || 0);
  }, 0);
  return Math.max(0, (item.prezzo + extrasPrice - removalsPrice)) * item.quantity;
}
