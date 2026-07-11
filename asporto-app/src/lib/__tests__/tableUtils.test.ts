import { describe, it, expect } from 'vitest';
import { parseAperturaFromNote, setAperturaInNote } from '../tableUtils';

describe('tableUtils', () => {
  describe('parseAperturaFromNote', () => {
    it('estrae apertura da nota JSON', () => {
      expect(parseAperturaFromNote('{"apertura":"2026-07-11T16:00:00.000Z","text":""}')).toBe('2026-07-11T16:00:00.000Z');
    });

    it('ritorna null se nessuna apertura', () => {
      expect(parseAperturaFromNote('Solo testo')).toBeNull();
    });

    it('ritorna null per input null/undefined', () => {
      expect(parseAperturaFromNote(null)).toBeNull();
      expect(parseAperturaFromNote(undefined)).toBeNull();
    });
  });

  describe('setAperturaInNote', () => {
    it('aggiunge apertura a nota vuota', () => {
      const result = setAperturaInNote('', '2026-07-11T16:00:00.000Z');
      expect(JSON.parse(result).apertura).toBe('2026-07-11T16:00:00.000Z');
    });

    it('sostituisce apertura esistente mantenendo testo', () => {
      const result = setAperturaInNote(JSON.stringify({ apertura: 'old', text: 'Testo' }), 'new');
      expect(JSON.parse(result)).toEqual({ apertura: 'new', text: 'Testo' });
    });

    it('aggiunge apertura a nota senza marker', () => {
      const result = setAperturaInNote('Testo', '2026-07-11T16:00:00.000Z');
      expect(JSON.parse(result).apertura).toBe('2026-07-11T16:00:00.000Z');
    });
  });
});
