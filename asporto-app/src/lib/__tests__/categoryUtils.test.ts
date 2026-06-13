import { describe, it, expect, beforeEach } from 'vitest';
import { getCategoryOrder, saveCategoryOrder, resetCategoryOrder, sortCategories } from '../categoryUtils';

const STORAGE_KEY = 'risto_category_order';

describe('categoryUtils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getCategoryOrder / saveCategoryOrder', () => {
    it('ritorna ordine vuoto di default', () => {
      expect(getCategoryOrder()).toEqual([]);
    });

    it('salva e recupera ordine', () => {
      saveCategoryOrder(['Antipasti', 'Primi', 'Secondi']);
      expect(getCategoryOrder()).toEqual(['Antipasti', 'Primi', 'Secondi']);
    });
  });

  describe('resetCategoryOrder', () => {
    it('resetta a array vuoto', () => {
      saveCategoryOrder(['A', 'B']);
      resetCategoryOrder();
      expect(getCategoryOrder()).toEqual([]);
    });
  });

  describe('sortCategories', () => {
    it('mantiene ordine se tutte presenti nella reference', () => {
      const result = sortCategories(['C', 'A', 'B'], ['A', 'B', 'C']);
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('mette alla fine categorie non in reference', () => {
      const result = sortCategories(['Z', 'A', 'X'], ['A']);
      expect(result[0]).toBe('A');
      expect(result).toContain('Z');
      expect(result).toContain('X');
    });
  });
});
