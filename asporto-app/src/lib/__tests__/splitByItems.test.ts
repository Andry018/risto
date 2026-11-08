import { describe, it, expect } from 'vitest';
import { applyItemSplit, splitAmount, subtractSaved } from '../splitByItems';
import { qtyByKey } from '../orderPending';
import type { CustomizedItem } from '../../types/entities';

const item = (uniqueId: string, nome: string, prezzo: number, quantity: number): CustomizedItem => ({
  id: nome, nome, prezzo, categoria: 'Pizze', disponibile: true, ingredienti: [],
  quantity, addedIngredients: [], removedIngredients: [], notes: '', uniqueId, portata: '1',
} as CustomizedItem);

const cart = [item('a', 'Margherita', 7, 2), item('b', 'Coca', 3, 3), item('c', 'COPERTO', 2, 3)];

describe('applyItemSplit', () => {
  it('paga 1 margherita, 1 coca e 1 coperto; il resto rimane', () => {
    const { paid, remaining } = applyItemSplit(cart, { a: 1, b: 1, c: 1 });
    expect(paid.map(p => [p.nome, p.quantity])).toEqual([['Margherita', 1], ['Coca', 1], ['COPERTO', 1]]);
    expect(remaining.map(p => [p.nome, p.quantity])).toEqual([['Margherita', 1], ['Coca', 2], ['COPERTO', 2]]);
  });
  it('selezione oltre la quantità viene limitata; riga pagata tutta sparisce dai rimasti', () => {
    const { paid, remaining } = applyItemSplit(cart, { a: 5 });
    expect(paid[0].quantity).toBe(2);
    expect(remaining.find(r => r.nome === 'Margherita')).toBeUndefined();
  });
  it('niente selezionato: tutto rimane', () => {
    expect(applyItemSplit(cart, {}).paid).toHaveLength(0);
  });
});

describe('splitAmount', () => {
  it('somma i piatti scelti e applica lo sconto in proporzione', () => {
    const { paid, remaining } = applyItemSplit(cart, { a: 1, b: 1, c: 1 });
    expect(splitAmount(paid, [])).toBe(12);
    // sconto 10% sul tavolo: le due parti sommano al totale scontato
    const ratio = 0.9;
    expect(splitAmount(paid, [], ratio) + splitAmount(remaining, [], ratio)).toBeCloseTo(splitAmount(cart, [], ratio), 2);
  });
});

describe('subtractSaved', () => {
  it('i pezzi pagati non risultano più già inviati', () => {
    const saved = qtyByKey(cart);
    const { paid } = applyItemSplit(cart, { b: 2 });
    const next = subtractSaved(saved, paid);
    expect([...next.values()].reduce((s, v) => s + v, 0)).toBe(8 - 2);
  });
});
