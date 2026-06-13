import { describe, it, expect } from 'vitest';
import { parseAperturaFromNote, getDisplayNote, setAperturaInNote, setNoteText } from '../tableUtils';

describe('tableUtils', () => {
  describe('parseAperturaFromNote', () => {
    it('estrae apertura da nota formattata', () => {
      expect(parseAperturaFromNote('[AP:12:30] Testo nota')).toBe('12:30');
    });

    it('ritorna null se nessuna apertura', () => {
      expect(parseAperturaFromNote('Solo testo')).toBeNull();
    });

    it('ritorna null per input null/undefined', () => {
      expect(parseAperturaFromNote(null)).toBeNull();
      expect(parseAperturaFromNote(undefined)).toBeNull();
    });
  });

  describe('getDisplayNote', () => {
    it('rimuove marker apertura dal display', () => {
      expect(getDisplayNote('[AP:12:30] Testo nota')).toBe('Testo nota');
    });

    it('ritorna testo invariato se nessun marker', () => {
      expect(getDisplayNote('Solo testo')).toBe('Solo testo');
    });

    it('ritorna stringa vuota per null', () => {
      expect(getDisplayNote(null)).toBe('');
    });
  });

  describe('setAperturaInNote', () => {
    it('aggiunge apertura a nota vuota', () => {
      expect(setAperturaInNote('', '20:00')).toBe('[AP:20:00]');
    });

    it('sostituisce apertura esistente', () => {
      expect(setAperturaInNote('[AP:12:00] Testo', '20:00')).toBe('[AP:20:00] Testo');
    });

    it('aggiunge apertura a nota senza marker', () => {
      expect(setAperturaInNote('Testo', '20:00')).toBe('[AP:20:00] Testo');
    });
  });

  describe('setNoteText', () => {
    it('sostituisce testo mantenendo apertura', () => {
      expect(setNoteText('[AP:12:00] Vecchio', 'Nuovo')).toBe('[AP:12:00] Nuovo');
    });

    it('sostituisce testo senza apertura', () => {
      expect(setNoteText('Vecchio', 'Nuovo')).toBe('Nuovo');
    });
  });
});
