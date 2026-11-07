import { describe, it, expect } from 'vitest';
import { computePending, qtyByKey, getItemKey } from '../orderPending';
import type { CustomizedItem } from '../../types/entities';

const item = (over: Partial<CustomizedItem>): CustomizedItem => ({
  id: 'p', nome: 'Carbonara', prezzo: 10, categoria: 'Primi', disponibile: true, ingredienti: [],
  quantity: 1, addedIngredients: [], removedIngredients: [], notes: '', uniqueId: Math.random().toString(36), portata: '1',
  ...over,
} as CustomizedItem);

describe('computePending', () => {
  it('carrello mai inviato: tutto nuovo, coperto escluso dal conteggio ma presente', () => {
    const coperto = item({ nome: 'COPERTO', categoria: 'Servizio', prezzo: 2, quantity: 4, uniqueId: 'cop' });
    const carb = item({ quantity: 2, uniqueId: 'carb' });
    const p = computePending([coperto, carb], new Map(), []);
    expect(p.count).toBe(2);
    expect(p.amount).toBe(28);
    expect(p.newQtyById.get('cop')).toBe(4);
    expect(p.newQtyById.get('carb')).toBe(2);
    expect(p.dirty).toBe(true);
  });

  it('dopo l\'invio niente è nuovo; aggiungendo 1 carbonara solo quella è nuova', () => {
    const carb = item({ quantity: 2, uniqueId: 'carb' });
    const saved = qtyByKey([carb]);
    expect(computePending([carb], saved, []).count).toBe(0);
    expect(computePending([carb], saved, []).dirty).toBe(false);
    const p = computePending([{ ...carb, quantity: 3 }], saved, []);
    expect(p.count).toBe(1);
    expect(p.newQtyById.get('carb')).toBe(1);
    expect(p.amount).toBe(10);
  });

  it('stesso piatto con modifica diversa = riga diversa e nuova', () => {
    const carb = item({ uniqueId: 'a' });
    const saved = qtyByKey([carb]);
    const senzaPepe = item({ uniqueId: 'b', removedIngredients: ['Pepe'] });
    expect(getItemKey(carb)).not.toBe(getItemKey(senzaPepe));
    const p = computePending([carb, senzaPepe], saved, []);
    expect(p.newQtyById.has('a')).toBe(false);
    expect(p.newQtyById.get('b')).toBe(1);
  });

  it('togliere un piatto già inviato rende il carrello da salvare ma senza nuovi', () => {
    const carb = item({ quantity: 2, uniqueId: 'carb' });
    const p = computePending([{ ...carb, quantity: 1 }], qtyByKey([carb]), []);
    expect(p.count).toBe(0);
    expect(p.dirty).toBe(true);
  });
});
