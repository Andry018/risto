import { describe, it, expect } from 'vitest';
import { detectAddition, sceneToFrame } from '../rearScreen';
import type { CustomizedItem } from '../../types/entities';

const item = (uniqueId: string, nome: string, quantity: number) =>
  ({ uniqueId, nome, quantity }) as CustomizedItem;

describe('detectAddition', () => {
  it('rileva una nuova riga', () => {
    expect(detectAddition([item('a', 'Coperto', 2)], [item('a', 'Coperto', 2), item('b', 'Margherita', 1)]))
      .toEqual({ nome: 'Margherita', qty: 1 });
  });

  it('rileva un aumento di quantità', () => {
    expect(detectAddition([item('b', 'Birra', 1)], [item('b', 'Birra', 3)])).toEqual({ nome: 'Birra', qty: 2 });
  });

  it('ignora rimozioni e diminuzioni', () => {
    expect(detectAddition([item('b', 'Birra', 3)], [item('b', 'Birra', 2)])).toBeNull();
    expect(detectAddition([item('b', 'Birra', 1)], [])).toBeNull();
  });

  it('ignora il caricamento di un ordine (più righe insieme)', () => {
    expect(detectAddition([], [item('a', 'Coperto', 2), item('b', 'Margherita', 1)])).toBeNull();
  });
});

describe('sceneToFrame', () => {
  it('tavolo: titolo con totale, dettaglio articoli', () => {
    const f = sceneToFrame({ kind: 'table', table: 'Tavolo 5', total: 42.5, items: 1 });
    expect(f.title).toMatch(/^Tavolo 5 · 42,50/);
    expect(f.subtitle).toBe('1 articolo');
  });

  it('aggiunta: mostra +qty nome', () => {
    const f = sceneToFrame({ kind: 'table', table: 'Tavolo 5', total: 10, items: 2, flash: { qty: 1, nome: 'Margherita' } });
    expect(f.title).toBe('+1 Margherita');
  });
});
