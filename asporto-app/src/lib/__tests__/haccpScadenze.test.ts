import { describe, it, expect } from 'vitest';
import { scadenzaStato, ordinaPerScadenza } from '../haccpScadenze';

const oggi = new Date(2026, 10, 7, 23, 30); // 7 novembre, tarda sera

describe('scadenzaStato', () => {
  it('scaduto, oggi, domani, ok', () => {
    expect(scadenzaStato('2026-11-06', oggi)).toBe('scaduto');
    expect(scadenzaStato('2026-11-07', oggi)).toBe('oggi');
    expect(scadenzaStato('2026-11-08', oggi)).toBe('domani');
    expect(scadenzaStato('2026-11-12', oggi)).toBe('ok');
  });
  it('il giorno di scadenza vale fino a sera (niente UTC)', () => {
    expect(scadenzaStato('2026-11-07', new Date(2026, 10, 7, 0, 30))).toBe('oggi');
  });
  it('fine mese e date mancanti', () => {
    expect(scadenzaStato('2026-12-01', new Date(2026, 10, 30, 12))).toBe('domani');
    expect(scadenzaStato('', oggi)).toBe('ok');
  });
});

describe('ordinaPerScadenza', () => {
  it('urgenti prima, poi per data', () => {
    const l = [{ data_scadenza: '2026-11-20' }, { data_scadenza: '2026-11-08' }, { data_scadenza: '2026-11-01' }, { data_scadenza: '2026-11-07' }];
    expect(ordinaPerScadenza(l, oggi).map(x => x.data_scadenza)).toEqual(['2026-11-01', '2026-11-07', '2026-11-08', '2026-11-20']);
  });
});
