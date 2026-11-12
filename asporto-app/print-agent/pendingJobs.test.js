// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPendingStore, AUTO_RETRY_MAX_AGE_MS } = require('./pendingJobs.js');

const quiet = { log: () => {}, warn: () => {} };
const notReady = () => Object.assign(new Error('Carta finita'), { printerNotReady: true, beforeConnect: false });
const midPrint = () => Object.assign(new Error('Socket chiuso'), { beforeConnect: false });
const job = (tableName) => ({ kind: 'kitchen', tableName, items: [{ nome: 'Margherita', quantity: 2 }, { nome: 'COPERTO', categoria: 'Servizio', quantity: 4 }] });

describe('comande in attesa (print agent)', () => {
  it('una comanda fallita prima della stampa si ristampa da sola quando la stampante torna pronta', async () => {
    let ready = false;
    const printed = [];
    const store = createPendingStore({ runJob: async (j) => { if (!ready) throw notReady(); printed.push(j.tableName); }, log: quiet });
    store.add(job('T1'), notReady());
    store.add(job('T2'), notReady());
    expect(store.list().map(e => [e.label, e.auto, e.items])).toEqual([['T1', true, ['2x Margherita']], ['T2', true, ['2x Margherita']]]);

    await store.flush();
    expect(printed).toEqual([]);
    expect(store.size).toBe(2);

    ready = true;
    await store.flush();
    expect(printed).toEqual(['T1', 'T2']); // in ordine
    expect(store.size).toBe(0);
  });

  it('se l\'errore arriva a stampa iniziata non si ristampa da sola (niente doppioni), solo a mano', async () => {
    const runJob = vi.fn().mockResolvedValue(undefined);
    const store = createPendingStore({ runJob, log: quiet });
    const e = store.add(job('T3'), midPrint());
    expect(store.list()[0].auto).toBe(false);
    await store.flush();
    expect(runJob).not.toHaveBeenCalled();
    expect(await store.retry(e.id)).toEqual({ ok: true });
    expect(runJob).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(0);
  });

  it('dopo 20 minuti smette di riprovare da sola, ma resta in lista', async () => {
    let t = 1_000_000;
    const runJob = vi.fn().mockRejectedValue(notReady());
    const store = createPendingStore({ runJob, now: () => t, log: quiet });
    store.add(job('T4'), notReady());
    t += AUTO_RETRY_MAX_AGE_MS + 1000;
    await store.flush();
    expect(runJob).not.toHaveBeenCalled();
    expect(store.list()[0].auto).toBe(false);
    expect(store.size).toBe(1);
  });

  it('elimina', () => {
    const store = createPendingStore({ runJob: async () => {}, log: quiet });
    const e = store.add(job('T5'), notReady());
    expect(store.remove(e.id)).toBe(true);
    expect(store.remove(e.id)).toBe(false);
  });
});
