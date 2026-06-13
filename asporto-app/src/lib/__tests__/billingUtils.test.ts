import { describe, it, expect } from 'vitest';
import { generateDocNumber } from '../billingUtils';

describe('generateDocNumber', () => {
  it('ritorna stringa col prefisso Doc-', () => {
    expect(generateDocNumber()).toMatch(/^Doc-/);
  });

  it('contiene l anno corrente', () => {
    const year = new Date().getFullYear().toString();
    expect(generateDocNumber()).toContain(year);
  });

  it('termina con suffisso numerico', () => {
    expect(generateDocNumber()).toMatch(/-\d{3}$/);
  });
});
