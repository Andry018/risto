import { describe, it, expect, beforeEach } from 'vitest';
import { getCategoryOrder, saveCategoryOrder, resetCategoryOrder, sortCategories } from '../categoryUtils';

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
    it('funziona con array vuoto', () => {
      expect(sortCategories([])).toEqual([]);
    });

    it('ritorna le categorie ordinate secondo salvataggio', () => {
      saveCategoryOrder(['A', 'B', 'C']);
      expect(sortCategories(['C', 'A', 'B'])).toEqual(['A', 'B', 'C']);
    });
  });
});
