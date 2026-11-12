import { describe, it, expect, vi, afterEach } from 'vitest';
import { printErrorMessage, printPreContoViaAgent, printKitchenViaAgent } from '../lanPrint';
import type { CustomizedItem } from '../../types/entities';

describe('printErrorMessage', () => {
  it('traduce gli errori di rete della stampante', () => {
    expect(printErrorMessage(new Error('connect ECONNREFUSED 192.168.1.50:9100'))).toMatch(/non raggiungibile/);
    expect(printErrorMessage(new Error('Socket timeout'))).toMatch(/non raggiungibile/);
  });
  it('lascia passare gli altri messaggi', () => {
    expect(printErrorMessage(new Error('Unknown print job'))).toBe('Unknown print job');
    expect(printErrorMessage(null)).toMatch(/print agent/);
  });
});

describe('sendPrintJob', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('estrae il campo error dalla risposta JSON del print agent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: 'connect ECONNREFUSED' }), { status: 500 })));
    await expect(printPreContoViaAgent([], 'T1', 0, '/print-agent')).rejects.toThrow('connect ECONNREFUSED');
  });
  it('segnala print agent irraggiungibile se fetch fallisce', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(printPreContoViaAgent([], 'T1', 0, '/print-agent')).rejects.toThrow(/non raggiungibile/);
  });
});

describe('panino composto', () => {
  afterEach(() => vi.unstubAllGlobals());
  const panino = {
    id: 'panino-builder', nome: 'Panino: Mario', prezzo: 8, categoria: 'Panini', disponibile: true, ingredienti: [],
    quantity: 1, addedIngredients: [], removedIngredients: [], notes: 'Hamburger vitello 200gr (Medio), Ketchup', uniqueId: 'u1',
  } as unknown as CustomizedItem;
  const pizza = { ...panino, id: 'p1', nome: 'Margherita', notes: 'ben cotta', uniqueId: 'u2' } as CustomizedItem;

  it('in comanda esce VEDI SCHEDA al posto degli ingredienti, le altre note restano', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await printKitchenViaAgent([panino, pizza], 'T1', '/print-agent');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items[0].notes).toBe('VEDI SCHEDA');
    expect(body.items[1].notes).toBe('ben cotta');
  });

  it('sul pre-conto solo il nome', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await printPreContoViaAgent([panino], 'T1', 8, '/print-agent');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items[0].notes || '').toBe('');
    expect(body.items[0].nome).toBe('Panino: Mario');
  });
});
