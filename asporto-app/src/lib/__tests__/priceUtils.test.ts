import { describe, it, expect } from 'vitest';
import { calculateItemPrice, roundCents } from '../priceUtils';
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

describe('roundCents', () => {
  it('toglie i decimali sporchi dei calcoli in virgola mobile', () => {
    expect(roundCents(23.5 * 0.9)).toBe(21.15);
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(12)).toBe(12);
  });
});
