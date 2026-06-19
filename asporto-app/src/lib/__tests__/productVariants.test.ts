import { describe, it, expect, beforeEach } from 'vitest';
import type { ProductVariant } from '../productVariants';
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
      const custom: ProductVariant[] = [{ id: 'v1', label: 'Test', price: 1, categories: 'Pizze', section: 'EXTRA', style: 'gold', stackable: false, order: 1 }];
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
      const variant: ProductVariant = { id: 'v1', label: 'Test', price: 0, categories: 'Pizze', section: 'EXTRA', style: 'gold', stackable: false, order: 0 };
      expect(variantMatchesCategoria('Pizze', variant)).toBe(true);
    });

    it('matcha lista separata da virgola', () => {
      const variant: ProductVariant = { id: 'v1', label: 'Test', price: 0, categories: 'Antipasti,Pizze,Primi', section: 'EXTRA', style: 'gold', stackable: false, order: 0 };
      expect(variantMatchesCategoria('Pizze', variant)).toBe(true);
    });

    it('non matcha categoria diversa', () => {
      const variant: ProductVariant = { id: 'v1', label: 'Test', price: 0, categories: 'Pizze,Antipasti', section: 'EXTRA', style: 'gold', stackable: false, order: 0 };
      expect(variantMatchesCategoria('Bevande', variant)).toBe(false);
    });
  });
});
