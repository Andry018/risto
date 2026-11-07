import { describe, it, expect } from 'vitest';
import { stockLevel, suggestedOrder, buildOrderGroups, orderText } from '../magazzinoOrdini';
import type { MagazzinoArticolo } from '../../types/entities';

const art = (over: Partial<MagazzinoArticolo>): MagazzinoArticolo => ({
  id: Math.random().toString(36), nome: 'Farina', categoria: 'Secco', unita_misura: 'kg',
  quantita: 10, soglia_minima: 5, costo_unitario: 1, note: '', created_at: '', updated_at: '',
  ...over,
});

describe('stockLevel', () => {
  it('finito, basso, ok', () => {
    expect(stockLevel({ quantita: 0, soglia_minima: 5 })).toBe('finito');
    expect(stockLevel({ quantita: 5, soglia_minima: 5 })).toBe('basso');
    expect(stockLevel({ quantita: 6, soglia_minima: 5 })).toBe('ok');
  });
  it('senza soglia non è mai basso (ma può essere finito)', () => {
    expect(stockLevel({ quantita: 1, soglia_minima: 0 })).toBe('ok');
    expect(stockLevel({ quantita: 0, soglia_minima: 0 })).toBe('finito');
  });
});

describe('suggestedOrder', () => {
  it('riporta al doppio della soglia', () => {
    expect(suggestedOrder({ quantita: 3, soglia_minima: 5, unita_misura: 'pz' })).toBe(7);
    expect(suggestedOrder({ quantita: 0, soglia_minima: 5, unita_misura: 'pz' })).toBe(10);
  });
  it('kg e L arrotondati a mezzo, pezzi all\'unità', () => {
    expect(suggestedOrder({ quantita: 1.3, soglia_minima: 2, unita_misura: 'kg' })).toBe(3);
    expect(suggestedOrder({ quantita: 1.2, soglia_minima: 1.5, unita_misura: 'kg' })).toBe(2);
    expect(suggestedOrder({ quantita: 0.4, soglia_minima: 1, unita_misura: 'pz' })).toBe(2);
  });
  it('niente da ordinare se la scorta è sopra soglia', () => {
    expect(suggestedOrder({ quantita: 9, soglia_minima: 5, unita_misura: 'kg' })).toBe(0);
  });
});

describe('buildOrderGroups / orderText', () => {
  const nomi: Record<string, string> = { f1: 'Molino Rossi', f2: 'Caseificio Bianchi' };
  const name = (id?: string | null) => (id ? nomi[id] : undefined);
  const list = [
    art({ nome: 'Farina 00', fornitore_id: 'f1', quantita: 2, soglia_minima: 10 }),
    art({ nome: 'Mozzarella', fornitore_id: 'f2', quantita: 0, soglia_minima: 3, unita_misura: 'kg' }),
    art({ nome: 'Lievito', fornitore_id: 'f1', quantita: 50, soglia_minima: 5 }),
    art({ nome: 'Tovaglioli', quantita: 1, soglia_minima: 2, unita_misura: 'pz' }),
  ];
  it('raggruppa per fornitore, esclude gli ok, "Senza fornitore" in fondo', () => {
    const g = buildOrderGroups(list, name);
    expect(g.map(x => x.fornitore)).toEqual(['Caseificio Bianchi', 'Molino Rossi', 'Senza fornitore']);
    expect(g[1].righe.map(r => r.articolo.nome)).toEqual(['Farina 00']);
    expect(g[1].righe[0].quantita).toBe(18);
  });
  it('testo per il fornitore', () => {
    const t = orderText(buildOrderGroups(list, name)[0]);
    expect(t).toContain('ordine per Ristorante Il Girasole');
    expect(t).toContain('• Mozzarella: 6 kg');
  });
});
