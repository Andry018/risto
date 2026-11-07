import { describe, it, expect, vi, afterEach } from 'vitest';
import { printErrorMessage, printPreContoViaAgent } from '../lanPrint';

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
