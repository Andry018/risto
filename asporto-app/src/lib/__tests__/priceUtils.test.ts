import { describe, it, expect } from 'vitest';
import { calculateItemPrice } from '../priceUtils';
import type { Ingredient } from '../../types/entities';

const mockIngredients: Ingredient[] = [
  { id: '1', nome: 'Mozzarella', prezzo: 1.5, prezzo_rimozione: 0.5, disponibile: true },
  { id: '2', nome: 'Funghi', prezzo: 2.0, prezzo_rimozione: 0.8, disponibile: true },
  { id: '3', nome: 'Prosciutto', prezzo: 2.5, prezzo_rimozione: 1.0, disponibile: true },
];

describe('calculateItemPrice', () => {
  it('calcola prezzo base senza modifiche', () => {
    const result = calculateItemPrice(
      { prezzo: 10, quantity: 2, addedIngredients: [], removedIngredients: [] },
      mockIngredients
    );
    expect(result).toBe(20);
  });

  it('somma prezzo aggiunte', () => {
    const result = calculateItemPrice(
      {
        prezzo: 8,
        quantity: 1,
        addedIngredients: [{ nome: 'Mozzarella', prezzo: 1.5 }, { nome: 'Funghi', prezzo: 2.0 }],
        removedIngredients: [],
      },
      mockIngredients
    );
    expect(result).toBe(11.5);
  });

  it('sottrae prezzo rimozioni', () => {
    const result = calculateItemPrice(
      {
        prezzo: 10,
        quantity: 1,
        addedIngredients: [],
        removedIngredients: ['Mozzarella', 'Prosciutto'],
      },
      mockIngredients
    );
    expect(result).toBe(8.5);
  });

  it('non scende sotto zero', () => {
    const result = calculateItemPrice(
      {
        prezzo: 1,
        quantity: 1,
        addedIngredients: [],
        removedIngredients: ['Mozzarella', 'Funghi', 'Prosciutto'],
      },
      mockIngredients
    );
    expect(result).toBe(0);
  });

  it('moltiplica per quantità', () => {
    const result = calculateItemPrice(
      {
        prezzo: 5,
        quantity: 3,
        addedIngredients: [{ nome: 'Mozzarella', prezzo: 1.5 }],
        removedIngredients: ['Funghi'],
      },
      mockIngredients
    );
    const expectedPerUnit = 5 + 1.5 - 0.8;
    expect(result).toBe(expectedPerUnit * 3);
  });

  it('gestisce ingredienti non trovati nella lista (prezzo_rimozione = 0)', () => {
    const result = calculateItemPrice(
      {
        prezzo: 10,
        quantity: 1,
        addedIngredients: [],
        removedIngredients: ['Ingrediente Inesistente'],
      },
      mockIngredients
    );
    expect(result).toBe(10);
  });
});
