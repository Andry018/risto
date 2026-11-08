import type { Tavolo } from '../types/entities';

export const SALE = ['Principale', 'Verde', 'Rotonda', 'Terrazza'] as const;
export type Sala = typeof SALE[number];

/** Normalizza il nome della sala come fa TableMapView ('SALA' o vuoto = Principale). */
export function salaDi(t: Pick<Tavolo, 'sala'>): string {
  const s = (t.sala || 'Principale').trim();
  return s.toUpperCase() === 'SALA' ? 'Principale' : s;
}
