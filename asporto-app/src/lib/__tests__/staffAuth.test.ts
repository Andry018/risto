import { describe, it, expect, beforeEach, vi } from 'vitest';

const rpc = vi.fn();
let storedToken: string | null = null;
vi.mock('../supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args), from: vi.fn() },
  getStaffToken: () => storedToken,
  setStaffToken: (t: string | null) => { storedToken = t; },
  decodeStaffToken: (t: string) => JSON.parse(atob(t.split('.')[1])),
  STAFF_TOKEN_INVALID_EVENT: 'risto:staff-token-invalid',
}));

import {
  getDefaultStaffPin,
  getStaffUsers,
  verifyStaffPin,
  verifyManagerPin,
  getCurrentUser,
  isStaffSessionValid,
  setStaffSessionValid,
  clearStaffSession,
  legacyStaffUser,
  hasPermission,
  getDefaultRouteForRole,
} from '../staffAuth';

const MARIO = { id: 'u-mario', name: 'Mario', role: 'waiter' as const };

function seedUsers(users: object[]) {
  localStorage.setItem('risto_staff_users', JSON.stringify(users));
}

/** JWT finto (la firma la verifica il server, qui conta solo il contenuto) */
function fakeToken(sub: string): string {
  const now = Math.floor(Date.now() / 1000);
  return `h.${btoa(JSON.stringify({ sub, iat: now, exp: now + 3600, staff_role: 'waiter' }))}.s`;
}

describe('staffAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    rpc.mockReset();
    storedToken = null;
  });

  describe('getDefaultStaffPin', () => {
    it('ritorna il PIN predefinito quando non è stato cambiato', () => {
      expect(getDefaultStaffPin()).toBe('2580');
    });
  });

  describe('elenco operatori in cache', () => {
    it('vuoto di default', () => {
      expect(getStaffUsers()).toHaveLength(0);
    });

    it('scarta i PIN in chiaro salvati dalle versioni precedenti', () => {
      seedUsers([{ ...MARIO, pin: '1111' }]);
      expect(getStaffUsers()).toEqual([MARIO]);
    });
  });

  describe('verifyStaffPin (login sul server)', () => {
    it('PIN giusto: salva il token restituito dal server', async () => {
      const token = fakeToken(MARIO.id);
      rpc.mockResolvedValue({ data: token, error: null });
      expect(await verifyStaffPin(MARIO.id, ' 1111 ')).toEqual({ ok: true });
      expect(rpc).toHaveBeenCalledWith('staff_login', { p_user_id: MARIO.id, p_pin: '1111' });
      expect(storedToken).toBe(token);
    });

    it('PIN sbagliato: nessun token', async () => {
      rpc.mockResolvedValue({ data: null, error: null });
      expect((await verifyStaffPin(MARIO.id, '9999')).ok).toBe(false);
      expect(storedToken).toBeNull();
    });

    it('cambio operatore: il token del precedente viene scartato', async () => {
      storedToken = fakeToken('u-altro');
      rpc.mockResolvedValue({ data: null, error: null });
      await verifyStaffPin(MARIO.id, '9999');
      expect(storedToken).toBeNull();
    });

    it('riporta il blocco per troppi tentativi', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'Troppi tentativi: riprova tra 15 minuti' } });
      expect(await verifyStaffPin(MARIO.id, '9999')).toEqual({ ok: false, error: 'Troppi tentativi: riprova tra 15 minuti' });
    });

    it('offline rifiuta un PIN mai usato su questo dispositivo', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } });
      expect(await verifyStaffPin(MARIO.id, '1111')).toEqual({ ok: false, error: 'Server non raggiungibile' });
    });
  });

  describe('verifyManagerPin', () => {
    it('senza amministratori nel DB usa il PIN locale di prima configurazione', async () => {
      rpc.mockResolvedValue({ data: null, error: null });
      expect((await verifyManagerPin('2580')).ok).toBe(true);
      expect((await verifyManagerPin('0000')).ok).toBe(false);
    });

    it('con amministratori vale solo la risposta del server', async () => {
      rpc.mockResolvedValue({ data: false, error: null });
      expect((await verifyManagerPin('2580')).ok).toBe(false);
    });
  });

  describe('sessione (persistita sul dispositivo)', () => {
    it('nessun operatore loggato di default', () => {
      expect(getCurrentUser()).toBeNull();
      expect(isStaffSessionValid()).toBe(false);
    });

    it("salva e recupera la sessione dell'operatore corrente", () => {
      seedUsers([MARIO]);
      storedToken = fakeToken(MARIO.id);
      setStaffSessionValid(MARIO);
      expect(isStaffSessionValid()).toBe(true);
      expect(getCurrentUser()?.id).toBe(MARIO.id);
    });

    it('senza un token dello stesso operatore la sessione non vale (serve il PIN)', () => {
      seedUsers([MARIO]);
      setStaffSessionValid(MARIO);
      expect(getCurrentUser()).toBeNull();
      storedToken = fakeToken('u-altro');
      expect(getCurrentUser()).toBeNull();
    });

    it('la sessione di un operatore eliminato non è più valida', () => {
      seedUsers([MARIO]);
      storedToken = fakeToken(MARIO.id);
      setStaffSessionValid(MARIO);
      seedUsers([]);
      expect(getCurrentUser()).toBeNull();
    });

    it('login di prima configurazione valido solo finché non ci sono operatori', () => {
      setStaffSessionValid(legacyStaffUser());
      expect(getCurrentUser()?.role).toBe('admin');
      seedUsers([MARIO]);
      expect(getCurrentUser()).toBeNull();
    });

    it('clearStaffSession rimuove sessione e token', () => {
      seedUsers([MARIO]);
      storedToken = fakeToken(MARIO.id);
      setStaffSessionValid(MARIO);
      clearStaffSession();
      expect(getCurrentUser()).toBeNull();
      expect(storedToken).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('admin può sempre tutto', () => {
      expect(hasPermission('admin', 'admin')).toBe(true);
      expect(hasPermission('admin', 'waiter')).toBe(true);
      expect(hasPermission('admin', ['kitchen'])).toBe(true);
    });

    it('un ruolo non-admin è ammesso solo se incluso nei ruoli richiesti', () => {
      expect(hasPermission('waiter', 'waiter')).toBe(true);
      expect(hasPermission('waiter', ['admin', 'waiter'])).toBe(true);
      expect(hasPermission('waiter', 'admin')).toBe(false);
      expect(hasPermission('kitchen', ['admin', 'waiter'])).toBe(false);
    });
  });

  describe('getDefaultRouteForRole', () => {
    it('ritorna root per qualsiasi ruolo', () => {
      expect(getDefaultRouteForRole('admin')).toBe('/');
      expect(getDefaultRouteForRole('waiter')).toBe('/');
      expect(getDefaultRouteForRole('kitchen')).toBe('/');
    });
  });
});
