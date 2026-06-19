import { describe, it, expect } from 'vitest';
import { generateDocNumber } from '../billingUtils';

describe('generateDocNumber', () => {
  it('ritorna stringa col prefisso Doc-', async () => {
    expect(await generateDocNumber()).toMatch(/^Doc-/);
  });

  it('contiene l anno corrente', async () => {
    const year = new Date().getFullYear().toString();
    expect(await generateDocNumber()).toContain(year);
  });

  it('termina con suffisso numerico', async () => {
    expect(await generateDocNumber()).toMatch(/-\d{3}$/);
  });
});
