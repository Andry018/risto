import { describe, it, expect, beforeEach } from 'vitest';
import { getCategoryOrder, saveCategoryOrder, resetCategoryOrder, sortCategories } from '../categoryUtils';

describe('categoryUtils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getCategoryOrder / saveCategoryOrder', () => {
    it('ritorna default vuoto se localStorage vuoto', () => {
      const order = getCategoryOrder();
      expect(order.length).toBeGreaterThan(0);
    });

    it('salva e recupera ordine', () => {
      saveCategoryOrder(['Antipasti', 'Primi', 'Secondi']);
      expect(getCategoryOrder()).toEqual(['Antipasti', 'Primi', 'Secondi']);
    });
  });

  describe('resetCategoryOrder', () => {
    it('resetta a default', () => {
      saveCategoryOrder(['A', 'B']);
      resetCategoryOrder();
      expect(getCategoryOrder().length).toBeGreaterThan(0);
    });
  });

  describe('sortCategories', () => {
    it('ordina secondo l ordine salvato', () => {
      saveCategoryOrder(['Antipasti', 'Primi', 'Secondi']);
      const result = sortCategories(['Secondi', 'Antipasti', 'Primi']);
      expect(result).toEqual(['Antipasti', 'Primi', 'Secondi']);
    });

    it('mette alla fine categorie non in ordine', () => {
      saveCategoryOrder(['Antipasti']);
      const result = sortCategories(['Z', 'Antipasti', 'X']);
      expect(result[0]).toBe('Antipasti');
      expect(result).toContain('Z');
      expect(result).toContain('X');
    });

    it('funziona con array vuoto', () => {
      expect(sortCategories([])).toEqual([]);
    });

    it('ritorna le categorie ordinate secondo salvataggio', () => {
      saveCategoryOrder(['A', 'B', 'C']);
      expect(sortCategories(['C', 'A', 'B'])).toEqual(['A', 'B', 'C']);
    });
  });
});
