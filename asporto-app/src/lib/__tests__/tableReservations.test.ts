import { describe, it, expect, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: null, IS_DEMO_MODE: false }));
vi.mock('../OfflineSync', () => ({ syncManager: { pushTableUpdate: vi.fn() } }));

import { pickReservation, confirmedFor, nearbyReservations, desiredTableState } from '../tableReservations';

const at = (h: number, m = 0) => new Date(2026, 10, 8, h, m);
const pranzo = { id: 'a', tavolo_id: 't5', status: 'CONFERMATA' as const, ora: '13:00:00', persone: 4 };
const cena = { id: 'b', tavolo_id: 't5', status: 'CONFERMATA' as const, ora: '20:30:00', persone: 6 };
const annullata = { id: 'c', tavolo_id: 't5', status: 'ANNULLATA' as const, ora: '21:00:00', persone: 2 };

describe('tableReservations', () => {
  it('confirmedFor tiene solo le confermate del tavolo, in ordine di orario', () => {
    expect(confirmedFor([cena, annullata, pranzo], 't5').map(r => r.id)).toEqual(['a', 'b']);
  });

  it('pickReservation sceglie quella di adesso o la prossima', () => {
    const list = [pranzo, cena];
    expect(pickReservation(list, at(11))?.id).toBe('a');
    expect(pickReservation(list, at(14, 0))?.id).toBe('a'); // entro 90 min di ritardo
    expect(pickReservation(list, at(15))?.id).toBe('b');
    expect(pickReservation(list, at(23, 30))?.id).toBe('b'); // tutte passate: l'ultima
    expect(pickReservation([], at(12))).toBeUndefined();
  });

  it('nearbyReservations segnala orari vicini sullo stesso tavolo', () => {
    expect(nearbyReservations([pranzo, cena], 't5', '21:00').map(r => r.id)).toEqual(['b']);
    expect(nearbyReservations([pranzo, cena], 't5', '17:00')).toEqual([]);
    expect(nearbyReservations([pranzo, cena], 't5', '20:30', 'b')).toEqual([]);
  });

  it('desiredTableState: non libera un tavolo che ha ancora una prenotazione oggi', () => {
    // annullato il pranzo, resta la cena: il tavolo resta prenotato (coperti della cena)
    expect(desiredTableState({ status: 'PRENOTATO', clienti: 4 }, [cena], at(12))).toEqual({ status: 'PRENOTATO', clienti: 6 });
    expect(desiredTableState({ status: 'PRENOTATO', clienti: 6 }, [cena], at(12))).toBeNull();
    expect(desiredTableState({ status: 'PRENOTATO', clienti: 6 }, [], at(12))).toEqual({ status: 'LIBERO', clienti: 0 });
    expect(desiredTableState({ status: 'LIBERO', clienti: 0 }, [pranzo, cena], at(15))).toEqual({ status: 'PRENOTATO', clienti: 6 });
    expect(desiredTableState({ status: 'OCCUPATO', clienti: 3 }, [], at(12))).toBeNull();
    expect(desiredTableState({ status: 'LIBERO', clienti: 0 }, [], at(12))).toBeNull();
    // pranzo non arrivato e passato da oltre 90 minuti: il tavolo si libera
    expect(desiredTableState({ status: 'PRENOTATO', clienti: 4 }, [pranzo], at(15))).toEqual({ status: 'LIBERO', clienti: 0 });
  });
});
