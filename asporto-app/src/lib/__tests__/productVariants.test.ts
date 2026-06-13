import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultVariants,
  getProductVariants,
  saveProductVariants,
  resetProductVariants,
  variantMatchesCategoria,
} from '../productVariants';

describe('productVariants', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getDefaultVariants', () => {
    it('ritorna array non vuoto', () => {
      const variants = getDefaultVariants();
      expect(variants.length).toBeGreaterThan(0);
    });

    it('ogni variante ha id, label, price, categories', () => {
      const variants = getDefaultVariants();
      variants.forEach(v => {
        expect(v.id).toBeTruthy();
        expect(v.label).toBeTruthy();
        expect(typeof v.price).toBe('number');
        expect(v.categories).toBeTruthy();
      });
    });
  });

  describe('getProductVariants / saveProductVariants', () => {
    it('ritorna default se nessun salvataggio', () => {
      expect(getProductVariants()).toEqual(getDefaultVariants());
    });

    it('salva e recupera varianti personalizzate', () => {
      const custom = [{ id: 'v1', label: 'Test', price: 1, categories: 'Pizze', section: 'EXTRA', style: 'gold', stackable: false, order: 1 }];
      saveProductVariants(custom);
      expect(getProductVariants()).toEqual(custom);
    });
  });

  describe('resetProductVariants', () => {
    it('resetta a default', () => {
      saveProductVariants([]);
      resetProductVariants();
      expect(getProductVariants()).toEqual(getDefaultVariants());
    });
  });

  describe('variantMatchesCategoria', () => {
    it('matcha categoria singola', () => {
      expect(variantMatchesCategoria('Pizze', 'Pizze')).toBe(true);
    });

    it('matcha lista separata da virgola', () => {
      expect(variantMatchesCategoria('Pizze', 'Antipasti,Pizze,Primi')).toBe(true);
    });

    it('non matcha categoria diversa', () => {
      expect(variantMatchesCategoria('Bevande', 'Pizze,Antipasti')).toBe(false);
    });
  });
});
