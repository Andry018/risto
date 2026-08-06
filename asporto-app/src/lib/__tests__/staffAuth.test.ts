import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultStaffPin,
  getStaffUsers,
  addStaffUser,
  removeStaffUser,
  updateStaffUser,
  verifyStaffPin,
  getCurrentUser,
  isStaffSessionValid,
  setStaffSessionValid,
  clearStaffSession,
  hasPermission,
  getDefaultRouteForRole,
} from '../staffAuth';

describe('staffAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getDefaultStaffPin', () => {
    it('ritorna il PIN predefinito quando non è stato cambiato', () => {
      expect(getDefaultStaffPin()).toBe('2580');
    });
  });

  describe('gestione operatori (CRUD)', () => {
    it('parte da una lista vuota', () => {
      expect(getStaffUsers()).toHaveLength(0);
    });

    it('aggiunge un operatore e lo persiste', () => {
      const user = addStaffUser('Mario', '1111', 'waiter');
      expect(user.name).toBe('Mario');
      expect(user.role).toBe('waiter');
      expect(getStaffUsers()).toHaveLength(1);
      expect(getStaffUsers()[0].id).toBe(user.id);
    });

    it('aggiorna un operatore esistente', () => {
      const user = addStaffUser('Mario', '1111', 'waiter');
      updateStaffUser(user.id, { name: 'Mario Rossi', role: 'admin' });
      const updated = getStaffUsers().find(u => u.id === user.id);
      expect(updated?.name).toBe('Mario Rossi');
      expect(updated?.role).toBe('admin');
    });

    it('rimuove un operatore', () => {
      const user = addStaffUser('Mario', '1111', 'waiter');
      removeStaffUser(user.id);
      expect(getStaffUsers()).toHaveLength(0);
    });

    it('rimuovendo l\'operatore con sessione attiva, la sessione viene invalidata', () => {
      const user = addStaffUser('Mario', '1111', 'waiter');
      setStaffSessionValid(user);
      expect(isStaffSessionValid()).toBe(true);
      removeStaffUser(user.id);
      expect(isStaffSessionValid()).toBe(false);
    });
  });

  describe('verifyStaffPin', () => {
    it('accetta il PIN corretto per l\'operatore giusto', () => {
      const user = addStaffUser('Mario', '1111', 'waiter');
      expect(verifyStaffPin(user.id, '1111')).toBe(true);
    });

    it('ignora spazi extra', () => {
      const user = addStaffUser('Mario', '1111', 'waiter');
      expect(verifyStaffPin(user.id, '  1111  ')).toBe(true);
    });

    it('rifiuta PIN errato', () => {
      const user = addStaffUser('Mario', '1111', 'waiter');
      expect(verifyStaffPin(user.id, '9999')).toBe(false);
    });

    it('rifiuta un userId inesistente', () => {
      expect(verifyStaffPin('non-esiste', '1111')).toBe(false);
    });
  });

  describe('sessione (persistita sul dispositivo)', () => {
    it('nessun operatore loggato di default', () => {
      expect(getCurrentUser()).toBeNull();
      expect(isStaffSessionValid()).toBe(false);
    });

    it('salva e recupera la sessione dell\'operatore corrente', () => {
      const user = addStaffUser('Mario', '1111', 'waiter');
      setStaffSessionValid(user);
      expect(isStaffSessionValid()).toBe(true);
      expect(getCurrentUser()?.id).toBe(user.id);
    });

    it('clearStaffSession rimuove la sessione', () => {
      const user = addStaffUser('Mario', '1111', 'waiter');
      setStaffSessionValid(user);
      clearStaffSession();
      expect(getCurrentUser()).toBeNull();
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
