import { describe, it, expect } from 'vitest';
import {
  findProductForOrderLine,
  findIngredientByName,
  calculateRemovalsPrice,
  addedIngredientsFromStoredOrderLine,
} from '../orderCarrelloMap';
import type { Product, Ingredient, OrderCarrelloItem } from '../../types/entities';

const mockProducts: Product[] = [
  { id: 'p1', nome: 'Margherita', prezzo: 7, categoria: 'Pizze', disponibile: true, ingredienti: [] },
  { id: 'p2', nome: 'Diavola', prezzo: 9, categoria: 'Pizze', disponibile: true, ingredienti: [] },
  { id: 'p3', nome: 'Coca Cola', prezzo: 3, categoria: 'Bevande', disponibile: true, ingredienti: [] },
];

const mockIngredients: Ingredient[] = [
  { id: 'i1', nome: 'Mozzarella', prezzo: 1.5, prezzo_rimozione: 0.5, disponibile: true },
  { id: 'i2', nome: 'Funghi', prezzo: 2.0, prezzo_rimozione: 0.8, disponibile: true },
];

describe('findProductForOrderLine', () => {
  it('trova prodotto per nome esatto', () => {
    expect(findProductForOrderLine(mockProducts, 'Margherita')?.id).toBe('p1');
  });

  it('ignora differenze maiuscole/minuscole', () => {
    expect(findProductForOrderLine(mockProducts, 'margherita')?.id).toBe('p1');
    expect(findProductForOrderLine(mockProducts, 'DIAVOLA')?.id).toBe('p2');
  });

  it('gestisce spazi extra', () => {
    expect(findProductForOrderLine(mockProducts, '  Coca Cola  ')?.id).toBe('p3');
  });

  it('ritorna undefined per prodotto inesistente', () => {
    expect(findProductForOrderLine(mockProducts, 'Inesistente')).toBeUndefined();
  });
});

describe('findIngredientByName', () => {
  it('trova ingrediente per nome', () => {
    expect(findIngredientByName(mockIngredients, 'Mozzarella')?.id).toBe('i1');
  });

  it('ignora case', () => {
    expect(findIngredientByName(mockIngredients, 'funghi')?.id).toBe('i2');
  });

  it('ritorna undefined se non trovato', () => {
    expect(findIngredientByName(mockIngredients, 'Inesistente')).toBeUndefined();
  });
});

describe('calculateRemovalsPrice', () => {
  it('somma prezzi rimozione', () => {
    const result = calculateRemovalsPrice(['Mozzarella', 'Funghi'], mockIngredients);
    expect(result).toBe(1.3);
  });

  it('ritorna 0 per lista vuota', () => {
    expect(calculateRemovalsPrice([], mockIngredients)).toBe(0);
  });

  it('ignora ingredienti non trovati', () => {
    expect(calculateRemovalsPrice(['Mozzarella', 'Inesistente'], mockIngredients)).toBe(0.5);
  });
});

describe('addedIngredientsFromStoredOrderLine', () => {
  const basePrezzo = 7;

  it('ricostruisce aggiunte con prezzo dalla tabella ingredienti', () => {
    const item: OrderCarrelloItem = {
      nome: 'Margherita',
      quantity: 1,
      prezzo_unitario: 10.5,
      modifiche: { aggiunte: ['Mozzarella', 'Funghi'] },
    };
    const result = addedIngredientsFromStoredOrderLine(item, mockIngredients, basePrezzo);
    expect(result).toEqual([
      { nome: 'Mozzarella', prezzo: 1.5 },
      { nome: 'Funghi', prezzo: 2.0 },
    ]);
  });

  it('ripartisce differenza se somma non coincide con prezzo_unitario', () => {
    const item: OrderCarrelloItem = {
      nome: 'Margherita',
      quantity: 1,
      prezzo_unitario: 12,
      modifiche: { aggiunte: ['Mozzarella', 'Funghi'] },
    };
    const result = addedIngredientsFromStoredOrderLine(item, mockIngredients, basePrezzo);
    const extrasTarget = 12 - basePrezzo;
    const each = extrasTarget / 2;
    expect(result).toEqual([
      { nome: 'Mozzarella', prezzo: each },
      { nome: 'Funghi', prezzo: each },
    ]);
  });

  it('ritorna lista vuota se nessuna aggiunta', () => {
    const item: OrderCarrelloItem = {
      nome: 'Margherita',
      quantity: 1,
      prezzo_unitario: 7,
    };
    const result = addedIngredientsFromStoredOrderLine(item, mockIngredients, basePrezzo);
    expect(result).toEqual([]);
  });

  it('considera rimozioni nel calcolo del target', () => {
    const item: OrderCarrelloItem = {
      nome: 'Margherita',
      quantity: 1,
      prezzo_unitario: 9,
      modifiche: { aggiunte: ['Mozzarella'], rimozioni: ['Funghi'] },
    };
    const result = addedIngredientsFromStoredOrderLine(item, mockIngredients, basePrezzo, 0.8);
    expect(result).toEqual([{ nome: 'Mozzarella', prezzo: 1.5 }]);
  });
});
