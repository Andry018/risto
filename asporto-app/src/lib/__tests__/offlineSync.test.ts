import { describe, it, expect, vi, beforeEach } from 'vitest';

const upserts: Record<string, unknown>[] = [];
const updates: { id: string; data: Record<string, unknown> }[] = [];
let hang = false;

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      upsert: (rows: Record<string, unknown>[]) => hang
        ? new Promise(() => { /* connessione appesa: non risponde mai */ })
        : (upserts.push(...rows), Promise.resolve({ error: null })),
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

  it('una richiesta appesa non blocca il salvataggio: va in timeout, resta in coda e riparte da sola', async () => {
    vi.useFakeTimers();
    vi.resetModules(); // il timer di ripresa nasce con il modulo: deve partire con l'orologio finto
    try {
      const { syncManager } = await import('../OfflineSync');
      hang = true;
      const push = syncManager.pushOrder({ nome_cliente: 'T9', status: 'IN_ATTESA', carrello: [], totale: 0 });
      await vi.advanceTimersByTimeAsync(12_500);
      const id = await push;
      expect(upserts).toHaveLength(0);
      expect(syncManager.getPendingCount()).toBe(1);

      hang = false;
      await vi.advanceTimersByTimeAsync(15_000);
      expect(upserts).toHaveLength(1);
      expect(upserts[0].id).toBe(id);
      expect(syncManager.getPendingCount()).toBe(0);
    } finally {
      hang = false;
      vi.useRealTimers();
    }
  });
});
