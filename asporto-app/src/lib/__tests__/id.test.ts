import { describe, it, expect } from 'vitest';
import { newUniqueId, stablePseudoMinutes } from '../id';

describe('newUniqueId', () => {
  it('genera stringa non vuota', () => {
    expect(newUniqueId().length).toBeGreaterThan(0);
  });

  it('genera ID univoci in chiamate successive', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newUniqueId()));
    expect(ids.size).toBe(100);
  });
});

describe('stablePseudoMinutes', () => {
  it('ritorna numero entro l intervallo', () => {
    const result = stablePseudoMinutes('test', 15, 45);
    expect(result).toBeGreaterThanOrEqual(15);
    expect(result).toBeLessThanOrEqual(45);
  });

  it('ritorna valore stabile per stesso seed', () => {
    const a = stablePseudoMinutes('margherita', 10, 50);
    const b = stablePseudoMinutes('margherita', 10, 50);
    expect(a).toBe(b);
  });

  it('ritorna valori diversi per seed diversi', () => {
    const a = stablePseudoMinutes('margherita', 10, 50);
    const b = stablePseudoMinutes('diavola', 10, 50);
    expect(a).not.toBe(b);
  });
});
