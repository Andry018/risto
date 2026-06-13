import { describe, it, expect } from 'vitest';
import {
  getDefaultStaffPin,
  getStaffUsers,
  verifyStaffPin,
  getCurrentUser,
  isStaffSessionValid,
  hasPermission,
  getDefaultRouteForRole,
} from '../staffAuth';

describe('staffAuth', () => {
  describe('getDefaultStaffPin', () => {
    it('ritorna il PIN predefinito', () => {
      expect(getDefaultStaffPin()).toBe('2580');
    });
  });

  describe('getStaffUsers', () => {
    it('ritorna lista con operatore locale', () => {
      const users = getStaffUsers();
      expect(users).toHaveLength(1);
      expect(users[0].role).toBe('admin');
    });
  });

  describe('verifyStaffPin', () => {
    it('accetta PIN corretto', () => {
      expect(verifyStaffPin('any', '2580')).toBe(true);
    });

    it('ignora spazi extra', () => {
      expect(verifyStaffPin('any', '  2580  ')).toBe(true);
    });

    it('rifiuta PIN errato', () => {
      expect(verifyStaffPin('any', '1234')).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('ritorna operatore locale con ruolo admin', () => {
      const user = getCurrentUser();
      expect(user.name).toBe('Locale');
      expect(user.role).toBe('admin');
    });
  });

  describe('isStaffSessionValid', () => {
    it('ritorna sempre true in modalità locale', () => {
      expect(isStaffSessionValid()).toBe(true);
    });
  });

  describe('hasPermission', () => {
    it('ritorna sempre true in modalità locale', () => {
      expect(hasPermission('admin')).toBe(true);
      expect(hasPermission('waiter')).toBe(true);
      expect(hasPermission('kitchen')).toBe(true);
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
