import { describe, it, expect } from 'vitest';
import { phoneToJid, buildReservationText, dayLabel } from '../reservationWhatsapp';

describe('phoneToJid', () => {
  it('cellulare italiano senza prefisso → +39', () => {
    expect(phoneToJid('333 123 4567')).toBe('393331234567@s.whatsapp.net');
  });
  it('con +39, 0039 o spazi/trattini', () => {
    expect(phoneToJid('+39 333-123-4567')).toBe('393331234567@s.whatsapp.net');
    expect(phoneToJid('0039 3331234567')).toBe('393331234567@s.whatsapp.net');
  });
  it('numeri non validi → null', () => {
    expect(phoneToJid('')).toBeNull();
    expect(phoneToJid('12345')).toBeNull();
    expect(phoneToJid(undefined)).toBeNull();
  });
});

describe('testi', () => {
  const res = { nome: 'Mario Rossi', data: '2026-11-07', ora: '20:30:00', persone: 4 };
  it('data in italiano, ora senza secondi', () => {
    expect(dayLabel('2026-11-07')).toBe('sabato 7 novembre');
  });
  it('conferma con nome, persone, giorno e ora', () => {
    const t = buildReservationText(res, 'conferma');
    expect(t).toContain('Ciao Mario!');
    expect(t).toContain('4 persone');
    expect(t).toContain('sabato 7 novembre alle 20:30');
  });
  it('promemoria per una persona', () => {
    const t = buildReservationText({ ...res, persone: 1 }, 'promemoria');
    expect(t).toContain('oggi');
    expect(t).toContain('1 persona');
    expect(t).not.toContain('1 persone');
  });
});
