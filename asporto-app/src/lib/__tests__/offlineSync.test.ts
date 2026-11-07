import { describe, it, expect, vi, beforeEach } from 'vitest';

const upserts: Record<string, unknown>[] = [];
const updates: { id: string; data: Record<string, unknown> }[] = [];

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      upsert: async (rows: Record<string, unknown>[]) => { upserts.push(...rows); return { error: null }; },
      update: (data: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => { updates.push({ id, data }); return { error: null }; },
      }),
    }),
  },
}));

describe('syncManager.pushOrder', () => {
  beforeEach(() => { upserts.length = 0; updates.length = 0; localStorage.clear(); });

  it("restituisce l'id del nuovo ordine, lo stesso salvato nel DB", async () => {
    const { syncManager } = await import('../OfflineSync');
    const id = await syncManager.pushOrder({ nome_cliente: 'T1', status: 'IN_ATTESA', carrello: [], totale: 0 });
    expect(typeof id).toBe('string');
    expect(upserts).toHaveLength(1);
    expect(upserts[0].id).toBe(id);
  });

  it("per un aggiornamento restituisce l'id esistente e non crea un nuovo ordine", async () => {
    const { syncManager } = await import('../OfflineSync');
    const id = await syncManager.pushOrder({ id: 'ord-1', totale: 10 });
    expect(id).toBe('ord-1');
    expect(upserts).toHaveLength(0);
    expect(updates[0]).toEqual({ id: 'ord-1', data: { totale: 10 } });
  });
});
